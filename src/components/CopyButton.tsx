"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    const ok = await writeToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${className}`}
    >
      {copied ? <Check size={14} className="text-green-700" /> : <Copy size={14} />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
