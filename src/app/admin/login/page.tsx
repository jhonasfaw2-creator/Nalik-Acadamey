"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid password. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-navy px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 text-center sm:mb-8">
          <img
            src="/assets/logo.jpeg"
            alt="Nalik Academy"
            className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-bold text-white">Nalik Admin</h1>
          <p className="mt-1 text-sm text-white/50">
            Enter your password to access the dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-navy placeholder-gray-400 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="action-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Protected area. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
