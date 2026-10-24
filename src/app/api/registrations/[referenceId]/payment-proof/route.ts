
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function shortHtml(value: string) {
  return escapeHtml(Array.from(value).slice(0, 80).join(""));
}

function formatPaymentAmount(amount: number, currency: string) {
  const birrAmount = amount / 100;
  const formatted = new Intl.NumberFormat("en-ET", { maximumFractionDigits: 2 }).format(birrAmount);
  return `${escapeHtml(currency.toUpperCase())} ${formatted}`;
}

function getAdminRegistrationsUrl() {
  const configuredUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) return null;
  try {
    const appUrl = new URL(configuredUrl);
    if (appUrl.protocol !== "https:") return null;
    return new URL("/admin/registrations", appUrl).toString();
  } catch {
    return null;
  }
}

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
        fullName: true,
        referenceId: true,
        paymentProofStatus: true,
        course: {
          select: {
            title: true,
            price: true,
            discountPrice: true,
            discountStartAt: true,
            discountEndAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { amount: true, currency: true },
        },
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

    const receiptImage = new Blob([bytes], { type: file.type });
    const blob = await put(
      `payment-proofs/${registration.id}/${randomUUID()}.${extension}`,
      receiptImage,
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

    const payment = registration.payments[0];
    const now = new Date();
    const discountIsActive = registration.course.discountPrice !== null &&
      (!registration.course.discountStartAt || registration.course.discountStartAt <= now) &&
      (!registration.course.discountEndAt || registration.course.discountEndAt >= now);
    const expectedAmountMinor = payment?.amount ??
      (discountIsActive ? registration.course.discountPrice! : registration.course.price) * 100;
    const currency = payment?.currency ?? "ETB";
    const appUrl = getAdminRegistrationsUrl();
    const details = [
      "<b>Payment proof submitted</b>",
      "",
      `<b>Name:</b> ${shortHtml(registration.fullName)}`,
      `<b>Course:</b> ${shortHtml(registration.course.title)}`,
      `<b>Amount:</b> ${formatPaymentAmount(expectedAmountMinor, currency)}`,
      `<b>Reference:</b> <code>${escapeHtml(registration.referenceId)}</code>`,
    ];
    const inlineKeyboard = [
      [
        { text: "Approve payment", callback_data: `APPROVED:${registration.id}` },
        { text: "Reject payment", callback_data: `REJECTED:${registration.id}` },
      ],
      ...(appUrl ? [[{ text: "Open admin registrations", url: appUrl }]] : []),
    ];

    let notificationSent = false;
    let proofSent = false;
    try {
      await sendTelegramPhoto(
        receiptImage,
        `payment-proof.${extension}`,
        details.join("\n"),
        inlineKeyboard,
      );
      notificationSent = true;
      proofSent = true;
    } catch (error) {
      console.error("Payment proof image could not be sent to Telegram:", error);
      try {
        await sendTelegramMessage(details.join("\n"), inlineKeyboard);
        notificationSent = true;
      } catch (notificationError) {
        // The proof is already saved as pending review; a Telegram outage must
        // not make the student upload it again or lose the submitted proof.
        console.error("Payment proof saved, but Telegram notification failed:", notificationError);
      }
    }

    return NextResponse.json(
      { success: true, status: "PENDING_REVIEW", notificationSent, proofSent },
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
