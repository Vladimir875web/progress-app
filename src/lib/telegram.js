const CLIENT_CODE_RE = /^[A-Z0-9]{6}$/;

export function getTelegramWebApp() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

/** Сырой startapp-параметр из Telegram (до валидации кода). */
export function getTelegramStartParamRaw() {
  if (typeof window === "undefined") return null;

  const tg = getTelegramWebApp();
  const fromInit = tg?.initDataUnsafe?.start_param;
  if (fromInit != null && fromInit !== "") return String(fromInit);

  const fromUrl = new URLSearchParams(window.location.search).get("tgWebAppStartParam");
  if (fromUrl) return fromUrl;

  return null;
}

export function normalizeClientCode(raw) {
  if (raw == null || raw === "") return null;
  const code = String(raw).trim().toUpperCase();
  return CLIENT_CODE_RE.test(code) ? code : null;
}

/** Код клиента из startapp (Direct Link Mini App). */
export function getTelegramStartCode() {
  return normalizeClientCode(getTelegramStartParamRaw());
}

/** Диагностика для отладки deep link (console + UI при ?debug=1). */
export function getTelegramStartDebugInfo() {
  const tg = getTelegramWebApp();
  const raw = getTelegramStartParamRaw();
  return {
    hasTelegram: Boolean(tg),
    start_param: tg?.initDataUnsafe?.start_param ?? null,
    tgWebAppStartParam: typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("tgWebAppStartParam")
      : null,
    rawParam: raw,
    parsedCode: normalizeClientCode(raw),
    platform: tg?.platform ?? null,
    href: typeof window !== "undefined" ? window.location.href : null,
  };
}

export function shouldShowStartDebug() {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

/**
 * Telegram иногда отдаёт start_param с задержкой — ждём и перечитываем.
 * Также читаем tgWebAppStartParam из URL (официальный fallback).
 */
export async function waitForTelegramStartCode({ maxMs = 3000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const code = getTelegramStartCode();
    if (code) return code;
    const tg = getTelegramWebApp();
    if (tg) tg.ready();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return getTelegramStartCode();
}

/**
 * Direct Link: https://t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=CLIENT_CODE
 * Важно: нужен /APP_SHORT_NAME из BotFather, не только ?startapp на бота.
 */
export function buildInviteLink(clientCode) {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  const app = import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME;
  if (!bot || !app || !clientCode) return null;
  return `https://t.me/${bot.replace(/^@/, "")}/${app}?startapp=${clientCode}`;
}
