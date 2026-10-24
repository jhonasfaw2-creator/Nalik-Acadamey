"use client";

import { useEffect, useState, useCallback } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    pending: 0,
    enrolled: 0,
    activeCourses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/admin/registrations").then((r) => { if (!r.ok) throw new Error("Failed to load registrations"); return r.json(); }),
      fetch("/api/admin/courses").then((r) => { if (!r.ok) throw new Error("Failed to load courses"); return r.json(); }),
    ]).then(([regData, courses]) => {
      const registrations: { status: string }[] = regData.applications || [];
      setStats({
        totalRegistrations: regData.totalCount ?? registrations.length,
        pending: regData.statusCounts?.PENDING || 0,
        enrolled: (regData.statusCounts?.PAID || 0) + (regData.statusCounts?.CONFIRMED || 0),
        activeCourses: (courses || []).filter((c: { active: boolean }) => c.active).length,
      });
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const cards = [
    { label: "Registrations", value: stats.totalRegistrations },
    { label: "Pending", value: stats.pending },
    { label: "Enrolled", value: stats.enrolled },
    { label: "Active courses", value: stats.activeCourses },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Registration and enrollment overview.</p>

      {error && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-words">{error}</span>
          <button onClick={loadStats} className="min-h-11 rounded-md bg-red-100 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-7 sm:mt-10 sm:grid-cols-4 sm:gap-8" aria-live="polite">
        {cards.map((card) => (
          card.label === "Pending" ? (
            <a key={card.label} href="/admin/registrations?status=PENDING" className="group min-w-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold" aria-label={`${card.value} pending registrations. Review pending registrations`}>
              <p className="text-sm text-gray-500 group-hover:text-navy">{card.label} <span aria-hidden="true" className="text-gold">↗</span></p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-navy sm:text-4xl">
                {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded bg-gray-200 align-middle sm:h-11" aria-label="Loading" /> : card.value}
              </p>
            </a>
          ) : (
            <div key={card.label} className="min-w-0">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-navy sm:text-4xl">
                {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded bg-gray-200 align-middle sm:h-11" aria-label="Loading" /> : card.value}
              </p>
            </div>
          )
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-9 flex flex-col gap-5 sm:mt-12 sm:flex-row sm:gap-12">
        <a href="/admin/registrations" className="group min-h-11 max-w-sm py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          <h3 className="font-semibold text-navy transition-colors group-hover:text-gold">Manage registrations <span aria-hidden="true">→</span></h3>
          <p className="mt-1 text-sm text-gray-500">Review payments and student enrollment.</p>
        </a>
        <a href="/admin/courses" className="group min-h-11 max-w-sm py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          <h3 className="font-semibold text-navy transition-colors group-hover:text-gold">Manage courses <span aria-hidden="true">→</span></h3>
          <p className="mt-1 text-sm text-gray-500">Update course details and pricing.</p>
        </a>
      </div>
    </div>
  );
}
