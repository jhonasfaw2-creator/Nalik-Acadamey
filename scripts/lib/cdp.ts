/**
 * Minimal Chrome DevTools Protocol driver (no extra dependencies).
 * Node 24 ships a global WebSocket, and Chrome exposes an HTTP endpoint for
 * creating tabs, so a few dozen lines are enough to drive a real browser.
 */

export interface CdpTarget {
  id: string;
  webSocketDebuggerUrl: string;
}

export class Cdp {
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private events: { method: string; params: any }[] = [];

  private constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id != null) {
        const waiter = this.pending.get(msg.id);
        if (waiter) {
          this.pending.delete(msg.id);
          if (msg.error) waiter.reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`));
          else waiter.resolve(msg.result);
        }
      } else if (msg.method) {
        this.events.push({ method: msg.method, params: msg.params });
      }
    });
  }

  static async launch(executable: string, port: number): Promise<void> {
    const { spawn } = await import("node:child_process");
    const child = spawn(
      executable,
      [
        `--remote-debugging-port=${port}`,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        // A per-port profile: Chrome refuses to start a second instance on an
        // existing profile (it would silently attach to the running browser
        // instead of exposing the requested debugging port).
        `--user-data-dir=/tmp/chapa-e2e-profile-${port}`,
        "about:blank",
      ],
      { stdio: "ignore", detached: true }
    );
    child.unref();
    // Wait for the debugging endpoint to come up.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("Chrome did not expose a debugging port in time");
  }

  static async openTab(port: number, url = "about:blank"): Promise<Cdp> {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    const target = (await res.json()) as CdpTarget;
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("CDP websocket failed")));
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    return cdp;
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluates an expression in the page and returns its JSON value. */
  async eval<T = unknown>(expression: string): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Page eval failed: ${result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result?.value as T;
  }

  async navigate(url: string, timeoutMs = 30_000): Promise<void> {
    const loaded = new Promise<void>((resolve) => {
      const check = () => {
        const i = this.events.findIndex((e) => e.method === "Page.loadEventFired");
        if (i >= 0) {
          this.events.splice(i, 1);
          resolve();
          return true;
        }
        return false;
      };
      const timer = setInterval(() => {
        if (check()) clearInterval(timer);
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, timeoutMs);
    });
    await this.send("Page.navigate", { url });
    await loaded;
  }

  waitFor(expression: string, timeoutMs = 30_000, intervalMs = 400): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
      const poll = async () => {
        if (await this.eval<boolean>(`!!(${expression})`).catch(() => false)) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(poll, intervalMs);
      };
      poll();
    });
  }

  /** Clicks the first element matching a CSS selector, or whose text matches. */
  async clickText(text: string): Promise<boolean> {
    return this.eval<boolean>(`(() => {
      const wanted = ${JSON.stringify(text)}.toLowerCase();
      const nodes = [...document.querySelectorAll('button, a, div[role=button], li, span, label, input[type=submit]')];
      const hit = nodes.find((el) => (el.innerText || el.value || '').trim().toLowerCase().includes(wanted));
      if (!hit) return false;
      hit.scrollIntoView({ block: 'center' });
      hit.click();
      return true;
    })()`);
  }

  /** Sets the value of an input so React's synthetic events fire. */
  async setInput(selectorOrPlaceholder: string, value: string): Promise<boolean> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const result = await this.eval<boolean>(`(() => {
        const sel = ${JSON.stringify(selectorOrPlaceholder)};
        const el = document.querySelector(sel) ||
          [...document.querySelectorAll('input, textarea')].find((i) =>
            ((i.placeholder || '') + (i.name || '') + (i.id || '')).toLowerCase().includes(sel.toLowerCase()));
        if (!el) return false;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (!setter) return false;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        return true;
      })()`).catch(() => false);
      if (result) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  async pageText(): Promise<string> {
    return this.eval<string>("document.body ? document.body.innerText : ''");
  }

  async url(): Promise<string> {
    return this.eval<string>("location.href");
  }

  async close(): Promise<void> {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

export async function killChrome(port: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}/json/close/`).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
