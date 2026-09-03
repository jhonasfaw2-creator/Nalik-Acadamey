"use client";

import { useEffect, useState } from "react";
import { Users, DollarSign, Clock, BookOpen } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    pending: 0,
    accepted: 0,
    totalPayments: 0,
    confirmedPayments: 0,
    totalRevenue: 0,
    activeCourses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/registrations").then((r) => r.json()),
      fetch("/api/admin/payments").then((r) => r.json()),
      fetch("/api/admin/courses").then((r) => r.json()),
    ]).then(([regData, payData, courses]) => {
      const confirmed = (payData || []).filter((p: { status: string }) => p.status === "confirmed");
      setStats({
        totalRegistrations: regData.applications?.length || 0,
        pending: regData.statusCounts?.pending || 0,
        accepted: regData.statusCounts?.accepted || 0,
        totalPayments: (payData || []).length,
        confirmedPayments: confirmed.length,
        totalRevenue: confirmed.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
        activeCourses: (courses || []).filter((c: { active: boolean }) => c.active).length,
      });
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const formatBirr = (n: number) => n.toLocaleString("en-ET") + " Birr";

  const cards = [
    { label: "Total Registrations", value: stats.totalRegistrations, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "bg-amber-50 text-amber-600" },
    { label: "Accepted", value: stats.accepted, icon: Users, color: "bg-green-50 text-green-600" },
    { label: "Active Courses", value: stats.activeCourses, icon: BookOpen, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Registration and payment overview.</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
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

          {/* Revenue card */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Confirmed Revenue</p>
                <p className="mt-1 text-2xl font-bold text-gold">{formatBirr(stats.totalRevenue)}</p>
                <p className="mt-0.5 text-xs text-gray-400">{stats.confirmedPayments} of {stats.totalPayments} payments confirmed</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
                <DollarSign size={22} className="text-gold" />
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <a href="/admin/registrations" className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-navy">Registrations</h3>
              <p className="mt-1 text-sm text-gray-500">View and manage student registrations.</p>
            </a>
            <a href="/admin/payments" className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-navy">Payments</h3>
              <p className="mt-1 text-sm text-gray-500">Track payment status and amounts.</p>
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
