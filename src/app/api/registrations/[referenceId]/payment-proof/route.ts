
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> },
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!checkAndIncrement(`payment-proof:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { referenceId } = await params;
    const registration = await prisma.registration.findUnique({
      where: { referenceId },
      select: {
        id: true,
        paymentProofStatus: true,
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found." },
        { status: 404 },
      );
    }

    if (
      registration.paymentProofStatus !== "NOT_SUBMITTED" &&
      registration.paymentProofStatus !== "REJECTED"
    ) {
      return NextResponse.json(
        { error: "A payment screenshot has already been submitted or is under review." },
        { status: 409 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a payment screenshot." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Upload a JPG, PNG, or WebP image." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The screenshot must be larger than 0 bytes and no more than 5 MB." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
    const isWebp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";

    if (
      (file.type === "image/jpeg" && !isJpeg) ||
      (file.type === "image/png" && !isPng) ||
      (file.type === "image/webp" && !isWebp)
    ) {
      return NextResponse.json(
        { error: "The file contents do not match the selected image type." },
        { status: 400 },
      );
    }

    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";

    const blob = await put(
      `payment-proofs/${registration.id}/${randomUUID()}.${extension}`,
      new Blob([bytes], { type: file.type }),
      {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      },
    );

    try {
      const updated = await prisma.registration.updateMany({
        where: {
          id: registration.id,
          paymentProofStatus: registration.paymentProofStatus,
        },
        data: {
          paymentProofPath: blob.pathname,
          paymentProofStatus: "PENDING_REVIEW",
          paymentProofSubmittedAt: new Date(),
          paymentProofReviewedAt: null,
          paymentProofNote: null,
        },
      });

      if (updated.count !== 1) {
        return NextResponse.json(
          { error: "The registration changed while uploading. Please try again." },
          { status: 409 },
        );
      }
    } catch (error) {
      console.error("Failed to save payment proof metadata:", error);
      return NextResponse.json(
        { error: "The screenshot uploaded, but its status could not be saved. Contact the academy before uploading again." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, status: "PENDING_REVIEW" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Payment proof upload failed:", error);
    return NextResponse.json(
      { error: "Unable to upload the screenshot. Please try again." },
      { status: 500 },
    );
  }
}
