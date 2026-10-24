type TelegramButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

type TelegramInlineKeyboard = TelegramButton[][];

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function telegramRequest<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as TelegramApiResponse<T> | null;

  if (!response.ok || !result?.ok) {
    const description = result?.description || response.statusText || "Unknown Telegram API error";
    throw new Error(`Telegram ${method} failed: ${description}`);
  }

  return result.result as T;
}

export async function sendTelegramMessage(
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard,
) {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not configured.");

  return telegramRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
  });
}

export async function sendTelegramPhoto(
  photo: Blob,
  filename: string,
  caption: string,
  inlineKeyboard?: TelegramInlineKeyboard,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not configured.");

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("photo", photo, filename);
  form.set("caption", caption);
  form.set("parse_mode", "HTML");
  if (inlineKeyboard) {
    form.set("reply_markup", JSON.stringify({ inline_keyboard: inlineKeyboard }));
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as TelegramApiResponse<{ message_id: number }> | null;
  if (!response.ok || !result?.ok) {
    const description = result?.description || response.statusText || "Unknown Telegram API error";
    throw new Error(`Telegram sendPhoto failed: ${description}`);
  }
  return result.result as { message_id: number };
}

export async function answerCallbackQuery(callbackQueryId: string, text: string) {
  return telegramRequest<boolean>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
) {
  return telegramRequest<boolean>("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  });
}

export async function editMessageCaption(
  chatId: number,
  messageId: number,
  caption: string,
) {
  return telegramRequest<boolean>("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  });
}
