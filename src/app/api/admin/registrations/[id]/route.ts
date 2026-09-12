import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";

// PUT /api/admin/registrations/[id] — update registration status.
//
// Payment status is owned by the payment record (set only by Chapa
// verification/webhooks); this endpoint only moves the registration between
// the review states.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { status } = body as { status?: unknown };

    if (typeof status !== "string" || !["PENDING_PAYMENT", "PAID", "CONFIRMED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let application;
    try {
      application = await prisma.application.update({
        where: { id },
        data: { status },
        include: {
          course: { select: { title: true } },
          schedule: { select: { id: true, group: true, session: true } },
        },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Admin registration update error:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
