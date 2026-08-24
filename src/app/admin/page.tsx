"use client";

import { useEffect, useState } from "react";

export default function AdminOverview() {
  const [stats, setStats] = useState({
    applications: 0,
    pending: 0,
    accepted: 0,
    courses: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/applications").then((r) => r.json()),
      fetch("/api/admin/courses").then((r) => r.json()),
    ]).then(([appData, courses]) => {
      setStats({
        applications: appData.applications?.length || 0,
        pending: appData.statusCounts?.pending || 0,
        accepted: appData.statusCounts?.accepted || 0,
        courses: courses?.length || 0,
      });
    });
  }, []);

  const cards = [
    { label: "Total Applications", value: stats.applications, color: "text-navy" },
    { label: "Pending Review", value: stats.pending, color: "text-gold" },
    { label: "Accepted", value: stats.accepted, color: "text-green-600" },
    { label: "Active Courses", value: stats.courses, color: "text-navy" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Overview of your academy.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href="/admin/applications"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
        >
          <h3 className="font-semibold text-navy">Applications</h3>
          <p className="mt-1 text-sm text-gray-500">
            View and manage student applications.
          </p>
        </a>
        <a
          href="/admin/courses"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
        >
          <h3 className="font-semibold text-navy">Courses</h3>
          <p className="mt-1 text-sm text-gray-500">
            Edit course details, pricing, and discounts.
          </p>
        </a>
      </div>
    </div>
  );
}
