"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, Loader2, KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const SETTING_FIELDS = [
  { key: "academy_name", label: "Academy Name", placeholder: "Nalik Academy" },
  { key: "academy_email", label: "Academy Email", placeholder: "info@nalikacademy.com" },
  { key: "academy_phone", label: "Academy Phone", placeholder: "+251 911 223 344" },
  { key: "academy_address", label: "Academy Address", placeholder: "Addis Ababa, Ethiopia" },
];

export default function AdminSettings() {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Change password state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    setError("");
    setLoading(true);
    fetch("/api/admin/settings")
      .then((r) => { if (!r.ok) throw new Error("Failed to load settings"); return r.json(); })
      .then((d) => { if (d && typeof d === "object" && !Array.isArray(d)) setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        setSaveError(result.error || "We couldn't save the settings. Please try again.");
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("Connection error. Your settings were not saved.");
    } finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword.length < 8) {
      setPwMessage({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: "New passwords do not match." });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        setPwMessage({ ok: true, text: "Password changed. Use the new password next time you sign in." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwMessage({ ok: false, text: d.error || "Failed to change password." });
      }
    } catch {
      setPwMessage({ ok: false, text: "Connection error. Please try again." });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={reload} className="mt-3 rounded-md bg-red-100 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight text-navy">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Academy info and contact settings.</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {saved && <span className="text-sm font-medium text-green-600">Saved</span>}
          <button onClick={handleSave} disabled={saving} className="action-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50 sm:flex-none">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      {saveError && <p className="mt-3 text-sm text-red-700" role="alert">{saveError}</p>}

      <div className="mt-8 space-y-10">
        {/* Academy Info */}
        <section>
          <h2 className="text-lg font-semibold text-navy mb-4">Academy information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_FIELDS.filter((f) => f.key.startsWith("academy_")).map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                <input
                  id={field.key}
                  value={data[field.key] || ""}
                  onChange={(e) => {
                    setData({ ...data, [field.key]: e.target.value });
                    setSaved(false);
                    setSaveError("");
                  }}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Change Password */}
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-navy">
            <KeyRound size={14} /> Change Password
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Replace the current (temporary) password with your own. The new password is required at
            next sign-in.
          </p>
          {pwMessage && (
            <div
              className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                pwMessage.ok
                  ? "border border-green-100 bg-green-50 text-green-700"
                  : "border border-red-100 bg-red-50 text-red-600"
              }`}
              role="alert"
            >
              {pwMessage.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
              <span>{pwMessage.text}</span>
            </div>
          )}
          <form onSubmit={handleChangePassword} className="grid gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor="pw-current" className="mb-1 block text-sm font-medium text-gray-700">Current password</label>
              <div className="relative">
                <input
                  id="pw-current"
                  type={showPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-10 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>
            </div>
            <div>
              <label htmlFor="pw-new" className="mb-1 block text-sm font-medium text-gray-700">New password</label>
              <div className="relative">
                <input
                  id="pw-new"
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-10 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={showPw ? "Hide passwords" : "Show passwords"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="pw-confirm" className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
              <input
                id="pw-confirm"
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                className="action-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50 sm:w-auto"
              >
                {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>

        {/* Enrollment Settings */}
        <section>
          <h2 className="text-lg font-semibold text-navy mb-4">Enrollment settings</h2>
          <p className="text-sm text-gray-600">
            New student registrations remain pending until an administrator confirms enrollment.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-gray-500">
            <li>• <strong>Pending</strong>: registration received, awaiting review</li>
            <li>• <strong>Enrolled</strong>: registration confirmed by an administrator</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
