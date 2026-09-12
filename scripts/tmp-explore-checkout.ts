/** Scratch: open Chapa's TEST checkout in headless Chrome and dump its DOM. */
import { readFileSync } from "node:fs";
import { Cdp } from "./lib/cdp";

const PORT = 9333;

async function main() {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    else v = v.split(/\s+#/)[0].trim();
    if (m[1].startsWith("CHAPA_") || !(m[1] in process.env)) process.env[m[1]] = v;
  }

  let checkout = process.argv[2];
  if (!checkout) {
    const res = await fetch("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: "10000",
        currency: "ETB",
        email: "student.test@gmail.com",
        first_name: "Live",
        last_name: "Test",
        phone: "0900123456",
        tx_ref: `NALIK-explore-${Date.now()}`,
        return_url: "https://example.com/return",
        callback_url: "https://example.com/cb",
      }),
    });
    const body = await res.json();
    console.log("initialize:", res.status, JSON.stringify(body).slice(0, 200));
    checkout = body?.data?.checkout_url as string;
  }
  console.log("checkout:", checkout);

  await Cdp.launch("/usr/bin/google-chrome", PORT);
  const cdp = await Cdp.openTab(PORT);
  await cdp.navigate(checkout);
  await new Promise((r) => setTimeout(r, 7000));

  console.log("\n=== URL ===", await cdp.url());
  console.log("\n=== PAGE TEXT ===\n" + (await cdp.pageText()).slice(0, 3000));
  console.log("\n=== INPUTS ===");
  console.log(
    await cdp.eval(
      "JSON.stringify([...document.querySelectorAll('input,textarea,select')].map(i=>({tag:i.tagName,type:i.type,id:i.id,name:i.name,ph:i.placeholder,val:i.value})),null,1)"
    )
  );
  console.log("\n=== BUTTONS ===");
  console.log(
    await cdp.eval(
      "JSON.stringify([...document.querySelectorAll('button,[role=button],input[type=submit]')].map(b=>({tag:b.tagName,txt:(b.innerText||b.value||'').trim().slice(0,60)})),null,1)"
    )
  );
  console.log("\n=== IFRAMES ===");
  console.log(await cdp.eval("JSON.stringify([...document.querySelectorAll('iframe')].map(f=>f.src))"));

  await cdp.close();
  console.log("\n(Chrome left running on port " + PORT + ")");
}

main().catch((err) => {
  console.error("explore crashed:", err);
  process.exit(1);
});
