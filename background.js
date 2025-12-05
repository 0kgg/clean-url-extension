const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "mc_eid",
  "ref",
  "tag",
  "aff",
  "aff_id",
  "affsource",
  "pid",
  "vid",
  "_branch_match_id"
]);

const AMAZON_HOST = /(^|\.)amazon\./i;
const NOTIFICATION_ICON = chrome.runtime.getURL("icons/icon-128.png");
const BADGE_OK = { text: "OK", color: "#16a34a" };
const BADGE_ERR = { text: "ERR", color: "#dc2626" };
const NOTIFICATION_ID = "clean-url-notify";
let notificationTimer = null;

chrome.action.onClicked.addListener(async (tab) => {
  const tabUrl = tab?.url;
  if (!tabUrl || isRestrictedUrl(tabUrl)) {
    await notify("このページではURLを取得できません。");
    flashBadge(BADGE_ERR);
    return;
  }

  const cleaned = cleanUrl(tabUrl);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyToClipboard,
      args: [cleaned]
    });
    await notify("コピーしました: " + cleaned);
    flashBadge(BADGE_OK);
  } catch (err) {
    console.error("clipboard write failed", err);
    await notify("コピーに失敗しました。");
    flashBadge(BADGE_ERR);
  }
});

function isRestrictedUrl(url) {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

function cleanUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (_err) {
    return raw;
  }

  if (AMAZON_HOST.test(url.hostname)) {
    url = normalizeAmazon(url);
  }

  removeTrackingParams(url);
  return url.toString();
}

function normalizeAmazon(url) {
  const asin = extractAsin(url);
  if (!asin) return url;

  url.pathname = `/dp/${asin}`;
  url.search = "";
  url.hash = "";
  return url;
}

function extractAsin(url) {
  const path = url.pathname;
  const patterns = [
    /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|o\/ASIN|exec\/obidos\/ASIN|gp\/aw\/ol)\/([A-Z0-9]{10})(?=\/|$)/i,
    /\/([A-Z0-9]{10})(?=\/|$)/
  ];

  for (const regex of patterns) {
    const match = path.match(regex);
    if (match?.[1]) return match[1].toUpperCase();
  }

  const queryAsin =
    url.searchParams.get("ASIN") || url.searchParams.get("asin");
  if (queryAsin && /^[A-Z0-9]{10}$/.test(queryAsin)) {
    return queryAsin.toUpperCase();
  }

  for (const segment of path.split("/")) {
    if (/^[A-Z0-9]{10}$/.test(segment)) return segment.toUpperCase();
  }

  return null;
}

function removeTrackingParams(url) {
  for (const key of Array.from(url.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
      url.searchParams.delete(key);
    }
  }
}

async function notify(message) {
  try {
    const opts = {
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title: "Clean URL",
      message
    };

    const updated = await chrome.notifications.update(NOTIFICATION_ID, opts);
    if (!updated) {
      await chrome.notifications.create(NOTIFICATION_ID, opts);
    }

    if (notificationTimer) clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
      chrome.notifications.clear(NOTIFICATION_ID);
    }, 2000);
  } catch (err) {
    console.warn("notification failed", err);
  }
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function flashBadge({ text, color }, durationMs = 2000) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, durationMs);
}
