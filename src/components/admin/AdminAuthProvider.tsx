"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AdminUser {
  email: string;
}

interface AdminAuthValue {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const loading = !authResolved;

  useEffect(() => {
    // Check existing session on mount
    fetch("/api/admin/auth")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.authenticated) {
          setUser(data.user);
        }
        setAuthResolved(true);
      })
      .catch(() => {
        setAuthResolved(true);
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return data.error || "Login failed";
    }

    setUser(data.user);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    // Clear the session cookie
    document.cookie =
      "admin_session=; Path=/; Max-Age=0; SameSite=Lax";
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be inside AdminAuthProvider");
  return ctx;
}
