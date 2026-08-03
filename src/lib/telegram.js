const CLIENT_CODE_RE = /^[A-Z0-9]{6}$/;

export function getTelegramWebApp() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

/** Код клиента из startapp (Direct Link Mini App). */
export function getTelegramStartCode() {
  const param = getTelegramWebApp()?.initDataUnsafe?.start_param;
  if (!param) return null;
  const code = String(param).trim().toUpperCase();
  return CLIENT_CODE_RE.test(code) ? code : null;
}

/**
 * Direct Link: https://t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=CLIENT_CODE
 * BOT_USERNAME и APP_SHORT_NAME — из BotFather (.env).
 */
export function buildInviteLink(clientCode) {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  const app = import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME;
  if (!bot || !app || !clientCode) return null;
  return `https://t.me/${bot.replace(/^@/, "")}/${app}?startapp=${clientCode}`;
}
