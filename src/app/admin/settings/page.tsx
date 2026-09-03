"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";

const SETTING_FIELDS = [
  { key: "academy_name", label: "Academy Name", placeholder: "Nalik Academy" },
  { key: "academy_email", label: "Academy Email", placeholder: "info@nalikacademy.com" },
  { key: "academy_phone", label: "Academy Phone", placeholder: "+251 911 223 344" },
  { key: "academy_address", label: "Academy Address", placeholder: "Addis Ababa, Ethiopia" },
  { key: "payment_bank_name", label: "Bank Name", placeholder: "e.g. Commercial Bank of Ethiopia" },
  { key: "payment_account_name", label: "Account Name", placeholder: "Account holder name" },
  { key: "payment_account_number", label: "Account Number", placeholder: "Bank account number" },
  { key: "payment_account_type", label: "Account Type", placeholder: "e.g. Savings, Current" },
  { key: "whatsapp_number", label: "WhatsApp Number", placeholder: "+251911223344" },
];

export default function AdminSettings() {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (res.ok) setSaved(true);
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Academy info, payment details, and contact settings.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-medium text-green-600">Saved</span>}
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Academy Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Academy Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_FIELDS.filter((f) => f.key.startsWith("academy_") || f.key === "whatsapp_number").map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                <input
                  value={data[field.key] || ""}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Payment Settings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Payment Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_FIELDS.filter((f) => f.key.startsWith("payment_")).map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                <input
                  value={data[field.key] || ""}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            These details will be shown to students during the registration process for bank transfer instructions.
          </p>
        </div>
      </div>
    </div>
  );
}
