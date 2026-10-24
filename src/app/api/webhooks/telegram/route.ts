import { NextRequest, NextResponse } from "next/server";
import { handleProofDecision } from "@/lib/services/registrationService";
import { answerCallbackQuery, editMessageText } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEW_ERRORS: Record<string, string> = {
  NOT_FOUND: "Registration not found.",
  NO_PROOF: "No payment screenshot was submitted.",
  NOT_PENDING: "This payment proof has already been reviewed.",
  SCHEDULE_REQUIRED: "A schedule is required before approval.",
  SCHEDULE_NOT_FOUND: "The selected schedule was not found.",
  SCHEDULE_UNAVAILABLE: "The selected schedule is unavailable.",
  SCHEDULE_FULL: "The selected schedule is full.",
};

type TelegramCallbackPayload = {
  callback_query?: {
    id?: unknown;
    data?: unknown;
    message?: {
      chat?: { id?: unknown };
      message_id?: unknown;
      text?: unknown;
    };
  };
};

async function answerCallback(queryId: string, text: string) {
  try {
    await answerCallbackQuery(queryId, text);
  } catch (error) {
    console.error("Unable to acknowledge Telegram payment review:", error);
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Telegram webhook is not configured." }, { status: 503 });
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as TelegramCallbackPayload | null;
  const callback = payload?.callback_query;
  if (!callback) return NextResponse.json({ success: true });

  const queryId = typeof callback.id === "string" ? callback.id : "";
  const data = typeof callback.data === "string" ? callback.data : "";
  const message = callback.message;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  const [action, registrationId, ...extra] = data.split(":");

  if (
    !queryId ||
    !message ||
    (typeof chatId !== "string" && typeof chatId !== "number") ||
    typeof messageId !== "number" ||
    !registrationId ||
    extra.length > 0 ||
    (action !== "APPROVED" && action !== "REJECTED")
  ) {
    return NextResponse.json({ success: false, error: "Invalid callback query." });
  }

  const authorizedChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!authorizedChatId) {
    console.error("TELEGRAM_CHAT_ID is not configured.");
    await answerCallback(queryId, "Payment review is not configured.");
    return NextResponse.json({ success: false, error: "Telegram chat is not configured." });
  }

  if (String(chatId) !== authorizedChatId) {
    await answerCallback(queryId, "This chat is not authorized to review payments.");
    return NextResponse.json({ success: false, error: "Unauthorized chat." });
  }

  try {
    await handleProofDecision(registrationId, action, `${action === "APPROVED" ? "Approved" : "Rejected"} via Telegram`);

    const decisionMessage = action === "APPROVED"
      ? "<b>Payment approved. Student enrolled.</b>"
      : "<b>Payment proof rejected. A replacement can be submitted.</b>";
    await answerCallback(queryId, action === "APPROVED" ? "Payment approved. Student enrolled." : "Payment proof rejected.");

    const originalText = typeof message.text === "string" ? message.text : "<b>Payment proof review</b>";
    try {
      await editMessageText(Number(chatId), messageId, `${originalText}\n\n${decisionMessage}`);
    } catch (error) {
      // The database decision is already committed; a message-edit failure
      // must not make Telegram retry and re-run an already completed review.
      console.error("Payment was reviewed, but its Telegram message could not be updated:", error);
    }

    return NextResponse.json({ success: true, status: action });
  } catch (error) {
    const errorKey = error instanceof Error ? error.message : "";
    const messageText = REVIEW_ERRORS[errorKey];
    if (messageText) {
      await answerCallback(queryId, messageText);
      if (errorKey === "NOT_PENDING") {
        const originalText = typeof message.text === "string" ? message.text : "<b>Payment proof review</b>";
        try {
          await editMessageText(Number(chatId), messageId, `${originalText}\n\n<b>Already reviewed.</b>`);
        } catch (editError) {
          console.error("Unable to remove completed Telegram review buttons:", editError);
        }
      }
      return NextResponse.json({ success: false, error: messageText });
    }

    console.error("Telegram payment review failed:", error);
    await answerCallback(queryId, "Review could not be completed. Please try again.");
    return NextResponse.json({ error: "Unable to process payment review." }, { status: 500 });
  }
}
