"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Image from "next/image";

interface PaymentInstructionsProps {
  amount: number;
}

interface PaymentMethodData {
  id: string;
  type: string;
  name: string;
  logo: string;
  logoAlt: string;
  details: { label: string; value: string; copyable?: boolean }[];
}

const PAYMENT_METHODS: PaymentMethodData[] = [
  {
    id: "boa",
    type: "Bank transfer" as const,
    name: "Bank of Abyssinia",
    logo: "https://www.temenos.com/wp-content/uploads/2023/07/BankofAbyssinia-logo.jpg",
    logoAlt: "Bank of Abyssinia logo",
    details: [
      { label: "Account name", value: "Nalik Academy" },
      { label: "Account number", value: "1000123456789", copyable: true },
    ],
  },
  {
    id: "telebirr",
    type: "Mobile money" as const,
    name: "Telebirr",
    logo: "/assets/payments/Telebirr.png",
    logoAlt: "Telebirr logo",
    details: [
      { label: "Wallet number", value: "0911223344", copyable: true },
    ],
  },
];

export default function PaymentInstructions({ amount }: PaymentInstructionsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");

  const copyValue = async (value: string, key: string) => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopyError("Copy isn’t available here. You can select the number and copy it manually.");
    }
  };

  return (
    <section aria-labelledby="payment-instructions-title" className="space-y-3 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gold">Payment</p>
          <h3 id="payment-instructions-title" className="mt-1 text-xl font-semibold text-navy sm:text-2xl">
            Choose how to pay
          </h3>
          <p className="mt-1 max-w-lg text-sm leading-5 text-gray-600">
            Transfer the amount using either account, then upload a clear receipt below.
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-6 rounded-lg bg-navy px-4 py-3 sm:min-w-44 sm:flex-col sm:items-start sm:gap-0">
          <span className="text-xs font-medium text-white/70">Amount due</span>
          <strong className="whitespace-nowrap text-base font-semibold text-gold sm:mt-0.5 sm:text-lg">
            {amount.toLocaleString("en-ET")} ETB
          </strong>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        {PAYMENT_METHODS.map((method) => (
          <PaymentMethod
            key={method.id}
            method={method}
            copiedKey={copiedKey}
            onCopy={copyValue}
          />
        ))}
      </div>

      {copyError && <p className="text-xs text-red-700" role="status">{copyError}</p>}

    </section>
  );
}

function PaymentMethod({
  method,
  copiedKey,
  onCopy,
}: {
  method: PaymentMethodData;
  copiedKey: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <article className="min-w-0 rounded-xl bg-warm-white p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex h-[4.5rem] w-28 shrink-0 items-center justify-center rounded-md bg-white p-2.5">
          {logoFailed ? (
            <span className="text-center text-[10px] font-semibold leading-tight text-navy">{method.name}</span>
          ) : (
            <Image
              src={method.logo}
              alt={method.logoAlt}
              fill
              sizes="112px"
              className="object-contain p-2"
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{method.type}</p>
          <h4 className="mt-0.5 break-words text-base font-semibold leading-5 text-navy">{method.name}</h4>
        </div>
      </div>

      <dl className="mt-3 space-y-2.5">
        {method.details.map((detail) => {
          const key = `${method.id}-${detail.label}`;
          const copied = copiedKey === key;
          return (
            <div key={detail.label} className="flex min-w-0 items-center justify-between gap-3 border-t border-navy/10 pt-2.5">
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">{detail.label}</dt>
                <dd className="mt-0.5 break-all font-mono text-sm font-semibold text-navy">{detail.value}</dd>
              </div>
              {detail.copyable && (
                <button
                  type="button"
                  onClick={() => void onCopy(detail.value, key)}
                  className="action-quiet inline-flex shrink-0 items-center gap-1.5 text-xs text-navy"
                  aria-label={`${copied ? "Copied" : "Copy"} ${detail.label.toLowerCase()}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          );
        })}
      </dl>
    </article>
  );
}
