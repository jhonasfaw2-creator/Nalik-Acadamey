"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Clock, BookOpen, CheckCircle } from "lucide-react";

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
    setError("");
    Promise.all([
      fetch("/api/admin/registrations").then((r) => { if (!r.ok) throw new Error("Failed to load registrations"); return r.json(); }),
      fetch("/api/admin/courses").then((r) => { if (!r.ok) throw new Error("Failed to load courses"); return r.json(); }),
    ]).then(([regData, courses]) => {
      const registrations: { status: string }[] = regData.applications || [];
      setStats({
        totalRegistrations: registrations.length,
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
    { label: "Total Registrations", value: stats.totalRegistrations, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "bg-amber-50 text-amber-600" },
    { label: "Enrolled", value: stats.enrolled, icon: CheckCircle, color: "bg-green-50 text-green-600" },
    { label: "Active Courses", value: stats.activeCourses, icon: BookOpen, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Registration and enrollment overview.</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadStats} className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
                      <Icon size={15} />
                    </div>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-navy">{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Quick links */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a href="/admin/registrations" className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-navy">Registrations</h3>
              <p className="mt-1 text-sm text-gray-500">View and manage student registrations.</p>
            </a>
            <a href="/admin/courses" className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-navy">Courses</h3>
              <p className="mt-1 text-sm text-gray-500">Edit course details, pricing, and availability.</p>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
