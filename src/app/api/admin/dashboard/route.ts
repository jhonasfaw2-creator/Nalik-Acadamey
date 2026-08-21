import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api/auth-guard";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const [allApps, contentRows] = await Promise.all([
      prisma.application.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          program: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.websiteContent.findMany({
        select: { key: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Application stats
    const stats = {
      total: allApps.length,
      pending: allApps.filter((a) => a.status === "pending").length,
      approved: allApps.filter((a) => a.status === "approved").length,
      rejected: allApps.filter((a) => a.status === "rejected").length,
    };

    // Recent applications (last 5)
    const recentApplications = allApps.slice(0, 5).map((app) => ({
      id: app.id,
      name: app.fullName,
      email: app.email,
      program: app.program,
      status: app.status,
      created_at: app.createdAt.toISOString(),
    }));

    // Recent content updates (last 5)
    const recentContentUpdates = contentRows.slice(0, 5).map((item) => ({
      key: item.key,
      label: item.key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      updated_at: item.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      stats,
      recentApplications,
      recentContentUpdates,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
