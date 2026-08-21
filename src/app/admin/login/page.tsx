"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function AdminLoginPage() {
  const { signIn, user, loading } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace("/admin");
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  // If user is logged in, show nothing while redirect happens
  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const err = await signIn(email, password);
    if (err) {
      setError("Invalid email or password. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push("/admin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-5">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded bg-gold/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-gold" />
          </div>
          <h1 className="text-xl font-bold text-white">
            {SITE_NAME}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Admin Dashboard
          </p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
        >
          <div className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nalikacademy.com"
                  className={cn(
                    "w-full rounded border border-white/15 bg-white/5 py-2.5 pl-10 pr-3.5 text-sm text-white",
                    "placeholder:text-white/25 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors"
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "w-full rounded border border-white/15 bg-white/5 py-2.5 pl-10 pr-3.5 text-sm text-white",
                    "placeholder:text-white/25 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors"
                  )}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "mt-1 flex h-11 items-center justify-center gap-2 rounded bg-gold text-sm font-bold text-navy transition-all duration-150",
                "hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        {/* Back to site */}
        <p className="mt-6 text-center text-xs text-white/30">
          <Link
            href="/"
            className="text-white/50 underline underline-offset-2 transition-colors hover:text-white/70"
          >
            ← Back to {SITE_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
