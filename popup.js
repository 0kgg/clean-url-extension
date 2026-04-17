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

function extractProduct() {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const pickText = (sel) => {
    const el = document.querySelector(sel);
    return el ? clean(el.textContent) : "";
  };
  const firstText = (selectors) => {
    for (const sel of selectors) {
      const t = pickText(sel);
      if (t) return t;
    }
    return "";
  };

  const findOverviewValue = (labelRegex) => {
    const rows = document.querySelectorAll(
      "#productOverview_feature_div tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr"
    );
    for (const row of rows) {
      const cells = row.querySelectorAll("td, th");
      if (cells.length < 2) continue;
      const label = clean(cells[0].textContent);
      if (labelRegex.test(label)) {
        const val = clean(cells[cells.length - 1].textContent);
        if (val && val !== label) return val;
      }
    }
    return "";
  };

  const pickVariant = (kind) => {
    const config = {
      color: {
        selectors: [
          "#variation_color_name .selection",
          "#inline-twister-expanded-dimension-text-color_name",
          "#inline-twister-row-color_name .a-truncate-cut",
          "tr.po-color td:nth-child(2) span.po-break-word",
          "tr.po-color td:nth-child(2) span"
        ],
        label: /(色|カラー|color)/i
      },
      size: {
        selectors: [
          "#variation_size_name .selection",
          "#inline-twister-expanded-dimension-text-size_name",
          "#inline-twister-row-size_name .a-truncate-cut",
          "tr.po-size td:nth-child(2) span.po-break-word",
          "tr.po-size td:nth-child(2) span",
          "#variation_style_name .selection"
        ],
        label: /(サイズ|寸法|size)/i
      }
    }[kind];
    return firstText(config.selectors) || findOverviewValue(config.label);
  };

  const title = pickText("#productTitle");

  const price = firstText([
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    "#corePrice_feature_div .a-price .a-offscreen",
    "#apex_desktop .a-price .a-offscreen",
    ".priceToPay .a-offscreen",
    "#price .a-offscreen",
    ".a-price .a-offscreen"
  ]);

  const color = pickVariant("color");
  const size = pickVariant("size");

  const qtyEl =
    document.getElementById("quantity") ||
    document.querySelector('select[name="quantity"]');
  const q = qtyEl && qtyEl.value ? parseInt(qtyEl.value, 10) : NaN;
  const quantity = Number.isFinite(q) && q > 0 ? q : 1;

  return { title, price, color, size, quantity };
}

function formatOutput({ title, color, size, price, quantity, url }) {
  const lines = [];
  const hasProductInfo = Boolean(title || color || size || price);

  if (title) lines.push("・" + title);
  if (color) lines.push("色: " + color);
  if (size) lines.push("サイズ: " + size);
  if (price) lines.push("単価：" + price);
  if (hasProductInfo) {
    const q = parseInt(quantity, 10);
    lines.push("個数：" + (Number.isFinite(q) && q > 0 ? q : 1) + "個");
  }
  if (url) lines.push(url);

  return lines.join("\n");
}

function setStatus(message, isError = false) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = isError ? "status error" : "status";
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const rawUrl = tab?.url || "";
  const usable = rawUrl && !isRestrictedUrl(rawUrl);
  const cleaned = usable ? cleanUrl(rawUrl) : rawUrl;

  document.getElementById("url").value = cleaned;

  if (tab && usable) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractProduct
      });
      const data = results?.[0]?.result;
      if (data) {
        document.getElementById("title").value = data.title || "";
        document.getElementById("price").value = data.price || "";
        document.getElementById("color").value = data.color || "";
        document.getElementById("size").value = data.size || "";
        document.getElementById("quantity").value = data.quantity || 1;
      }
    } catch (_err) {
      // 抽出不可（ストアページ等）。空欄のまま編集可能。
    }
  }

  document.getElementById("copy-btn").addEventListener("click", onCopy);
}

async function onCopy() {
  const text = formatOutput({
    title: document.getElementById("title").value.trim(),
    color: document.getElementById("color").value.trim(),
    size: document.getElementById("size").value.trim(),
    price: document.getElementById("price").value.trim(),
    quantity: document.getElementById("quantity").value.trim(),
    url: document.getElementById("url").value.trim()
  });

  try {
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました");
  } catch (_err) {
    setStatus("コピーに失敗しました", true);
  }
}

init();
