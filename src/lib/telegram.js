const CLIENT_CODE_RE = /^[A-Z0-9]{6}$/;

export function getTelegramWebApp() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

function readUrlStartParam() {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const fromQuery = search.get("tgWebAppStartParam");
  if (fromQuery) return fromQuery;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const fromHash = new URLSearchParams(hash).get("tgWebAppStartParam");
  if (fromHash) return fromHash;

  const hashMatch = hash.match(/(?:^|&)tgWebAppStartParam=([^&]+)/);
  return hashMatch ? decodeURIComponent(hashMatch[1]) : null;
}

export function getTelegramStartParamRaw() {
  if (typeof window === "undefined") return null;

  const tg = getTelegramWebApp();
  const fromInit = tg?.initDataUnsafe?.start_param;
  if (fromInit != null && fromInit !== "") return String(fromInit);

  return readUrlStartParam();
}

export function normalizeClientCode(raw) {
  if (raw == null || raw === "") return null;
  let code = String(raw).trim().toUpperCase();
  code = code.split(/[?&#]/)[0].trim();
  if (CLIENT_CODE_RE.test(code)) return code;
  const match = code.match(/[A-Z0-9]{6}/);
  return match && CLIENT_CODE_RE.test(match[0]) ? match[0] : null;
}

export function getTelegramStartCode() {
  return normalizeClientCode(getTelegramStartParamRaw());
}

/** Есть ли признаки открытия по invite-ссылке (до появления start_param). */
export function hasDeepLinkHint() {
  if (typeof window === "undefined") return false;
  if (getTelegramStartCode()) return true;
  const raw = getTelegramStartParamRaw();
  if (raw) return true;
  const href = window.location.href;
  return href.includes("tgWebAppStartParam");
}

export function getTelegramStartDebugInfo() {
  const tg = getTelegramWebApp();
  const raw = getTelegramStartParamRaw();
  return {
    hasTelegram: Boolean(tg),
    start_param: tg?.initDataUnsafe?.start_param ?? null,
    tgWebAppStartParam: readUrlStartParam(),
    rawParam: raw,
    parsedCode: normalizeClientCode(raw),
    platform: tg?.platform ?? null,
    href: typeof window !== "undefined" ? window.location.href : null,
    deepLinkHint: hasDeepLinkHint(),
  };
}

export function shouldShowStartDebug() {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function logStartDebug(label, extra) {
  if (!shouldShowStartDebug()) return;
  console.log(`[PROGRESS] ${label}`, extra ?? getTelegramStartDebugInfo());
}

/**
 * Ждём start_param в Telegram Mini App — параметр может прийти с задержкой после tg.ready().
 * В обычном браузере без признаков deep link возвращаем null сразу.
 */
export async function waitForTelegramStartCode({ maxMs = 3000, intervalMs = 75 } = {}) {
  const immediate = getTelegramStartCode();
  if (immediate) {
    logStartDebug("start_param (immediate)", { code: immediate });
    return immediate;
  }

  const raw = getTelegramStartParamRaw();
  if (raw && !normalizeClientCode(raw)) {
    logStartDebug("start_param invalid", { raw });
    return null;
  }

  const inTelegram = Boolean(getTelegramWebApp());
  const urlHint = typeof window !== "undefined" && window.location.href.includes("tgWebAppStartParam");

  if (!inTelegram && !urlHint && !raw) {
    logStartDebug("no deep link hint — skip wait");
    return null;
  }

  const waitMs = urlHint || raw ? maxMs : 600;
  logStartDebug("waiting for start_param…", { inTelegram, urlHint, raw, waitMs });

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const code = getTelegramStartCode();
    if (code) {
      logStartDebug("start_param received", { code, waitedMs: waitMs - (deadline - Date.now()) });
      return code;
    }
    const tg = getTelegramWebApp();
    if (tg) tg.ready();
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const final = getTelegramStartCode();
  logStartDebug(final ? "start_param (final)" : "start_param timeout", { code: final, ...getTelegramStartDebugInfo() });
  return final;
}

export function normalizeBotUsername(raw) {
  let s = String(raw || "").trim().replace(/^@/, "");
  if (!s) return "";
  const fromTme = s.match(/(?:https?:\/\/)?t\.me\/([^/?#]+)/i);
  if (fromTme) return fromTme[1];
  return s.split(/[/?#]/)[0];
}

export function normalizeAppShortName(raw, botUsername) {
  let s = String(raw || "").trim();
  if (!s) return "";
  const fromTme = s.match(/(?:https?:\/\/)?t\.me\/[^/?#]+\/([^/?#]+)/i);
  if (fromTme) return fromTme[1];
  if (botUsername && s.toLowerCase().startsWith(`${botUsername.toLowerCase()}/`)) {
    return s.slice(botUsername.length + 1).split(/[/?#]/)[0];
  }
  if (s.includes("/")) {
    const parts = s.split("/").filter(Boolean);
    return parts[parts.length - 1].split("?")[0];
  }
  return s.replace(/^\/+|\/+$/g, "").split("?")[0];
}

export function buildInviteLink(clientCode) {
  const bot = normalizeBotUsername(import.meta.env.VITE_TELEGRAM_BOT_USERNAME);
  const app = normalizeAppShortName(import.meta.env.VITE_TELEGRAM_APP_SHORT_NAME, bot);
  const code = normalizeClientCode(clientCode);
  if (!bot || !app || !code) return null;
  return `https://t.me/${bot}/${app}?startapp=${code}`;
}
