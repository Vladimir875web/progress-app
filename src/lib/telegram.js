const CLIENT_CODE_RE = /^[A-Z0-9]{6}$/;

export function getTelegramWebApp() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

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

export function getTelegramStartCode() {
  return normalizeClientCode(getTelegramStartParamRaw());
}

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

/** Ждём start_param только если есть признаки deep link — иначе сразу null. */
export async function waitForTelegramStartCode({ maxMs = 1200, intervalMs = 50 } = {}) {
  const immediate = getTelegramStartCode();
  if (immediate) return immediate;

  const raw = getTelegramStartParamRaw();
  if (raw && !normalizeClientCode(raw)) return null;

  const inTelegram = Boolean(getTelegramWebApp());
  const urlHint = typeof window !== "undefined" && window.location.search.includes("tgWebAppStartParam");

  if (!inTelegram && !urlHint && !raw) return null;

  const deadline = Date.now() + (raw || urlHint ? maxMs : 400);
  while (Date.now() < deadline) {
    const code = getTelegramStartCode();
    if (code) return code;
    const tg = getTelegramWebApp();
    if (tg) tg.ready();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return getTelegramStartCode();
}

export function buildInviteLink(clientCode) {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  const app = import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME;
  if (!bot || !app || !clientCode) return null;
  return `https://t.me/${bot.replace(/^@/, "")}/${app}?startapp=${clientCode}`;
}
