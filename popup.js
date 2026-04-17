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
  const clean = (s) =>
    (s || "").replace(/[\u200E\u200F]/g, "").replace(/\s+/g, " ").trim();
  const normalizeLabel = (s) =>
    clean(s).replace(/[:：\s]+$/, "").toLowerCase();
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

  const collectDetailPairs = () => {
    const containerSelectors = [
      "#productOverview_feature_div",
      "#productDetails_techSpec_section_1",
      "#productDetails_techSpec_section_2",
      "#productDetails_detailBullets_sections1",
      "#productDetails_expanderTables_depthLeftSections",
      "#productDetails_expanderTables_depthRightSections",
      "#detailBullets_feature_div",
      "#poExpander"
    ];
    const roots = new Set();
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el) roots.add(el);
    }
    document
      .querySelectorAll("table.prodDetTable, table.a-keyvalue")
      .forEach((t) => roots.add(t));

    const pairs = [];
    const seenTr = new Set();
    for (const root of roots) {
      root.querySelectorAll("tr").forEach((tr) => {
        if (seenTr.has(tr)) return;
        seenTr.add(tr);
        const cells = tr.querySelectorAll("th, td");
        if (cells.length < 2) return;
        const label = normalizeLabel(cells[0].textContent);
        const value = clean(cells[cells.length - 1].textContent);
        if (label && value && label !== value.toLowerCase()) {
          pairs.push({ label, value });
        }
      });

      root.querySelectorAll("li > span.a-list-item").forEach((outer) => {
        const labelEl = outer.querySelector("span.a-text-bold");
        if (!labelEl) return;
        const valueEl = labelEl.nextElementSibling;
        if (!valueEl) return;
        const label = normalizeLabel(labelEl.textContent);
        const value = clean(valueEl.textContent);
        if (label && value) pairs.push({ label, value });
      });
    }
    return pairs;
  };

  const findDetailValue = (pairs, labels) => {
    for (const candidate of labels) {
      const target = candidate.toLowerCase();
      const match = pairs.find((p) => p.label === target);
      if (match && match.value) return match.value;
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

  const pairs = collectDetailPairs();
  const brand = findDetailValue(pairs, [
    "ブランド",
    "メーカー",
    "製造元",
    "brand",
    "manufacturer"
  ]);
  const model = findDetailValue(pairs, [
    "メーカー型番",
    "item model number",
    "型番",
    "品番",
    "モデル番号",
    "model number",
    "part number"
  ]);

  return { title, price, color, size, quantity, brand, model };
}

const SHORTEN_STOP_KEYWORDS = [
  "メンズ", "レディース", "キッズ",
  "男女兼用", "男女共用", "ユニセックス", "男性用", "女性用",
  "日本製", "国産", "送料無料",
  "プレゼント", "ギフト",
  "正規品", "並行輸入", "新品", "未使用"
];

function shortenTitle(text) {
  const original = (text || "").trim();
  if (!original) return text;

  let brand = "";
  let rest = original;
  const brandMatch = rest.match(/^\s*([\[【][^\]】]+[\]】])\s*/);
  if (brandMatch) {
    brand = brandMatch[1].trim();
    rest = rest.slice(brandMatch[0].length).trim();
  }

  let cut = rest;
  const delimMatch = rest.match(/\s*[|｜/／、,–—]\s*/);
  if (delimMatch && delimMatch.index > 0) {
    cut = rest.slice(0, delimMatch.index).trim();
  } else {
    for (const kw of SHORTEN_STOP_KEYWORDS) {
      const idx = rest.indexOf(kw);
      if (idx > 3) {
        cut = rest.slice(0, idx).trim();
        break;
      }
    }
  }

  cut = cut.replace(/\s*[（(《〈][^）)》〉]*[）)》〉]\s*$/u, "").trim();

  const tokens = cut.split(/\s+/);
  const seen = new Set();
  const deduped = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(t);
    }
  }
  cut = deduped.join(" ");

  cut = cut.replace(/[\s　・･:：,、。\-–—]+$/u, "").trim();
  if (cut.length < 3) return text;

  return brand ? `${brand} ${cut}`.trim() : cut;
}

function buildModelTitle(originalTitle, brand, model) {
  if (!model) return "";
  const shortened = shortenTitle(originalTitle || "");
  const hint = shortened
    .replace(/^\s*[\[【][^\]】]+[\]】]\s*/, "")
    .trim();
  const prefix = brand ? `[${brand}] ${model}` : model;
  return hint ? `${prefix} ${hint}` : prefix;
}

async function loadSavedTitle(asin) {
  if (!asin) return "";
  try {
    const { titles = {} } = await chrome.storage.local.get("titles");
    return titles[asin] || "";
  } catch (_err) {
    return "";
  }
}

async function saveTitle(asin, title) {
  if (!asin || !title) return;
  try {
    const { titles = {} } = await chrome.storage.local.get("titles");
    titles[asin] = title;
    await chrome.storage.local.set({ titles });
  } catch (_err) {}
}

async function deleteSavedTitle(asin) {
  if (!asin) return;
  try {
    const { titles = {} } = await chrome.storage.local.get("titles");
    delete titles[asin];
    await chrome.storage.local.set({ titles });
  } catch (_err) {}
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

const state = {
  originalTitle: "",
  asin: "",
  brand: "",
  model: ""
};

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const rawUrl = tab?.url || "";
  const usable = rawUrl && !isRestrictedUrl(rawUrl);
  const cleaned = usable ? cleanUrl(rawUrl) : rawUrl;

  document.getElementById("url").value = cleaned;

  if (usable) {
    try {
      const u = new URL(rawUrl);
      if (AMAZON_HOST.test(u.hostname)) {
        state.asin = extractAsin(u) || "";
      }
    } catch (_err) {}
  }

  if (tab && usable) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractProduct
      });
      const data = results?.[0]?.result;
      if (data) {
        state.originalTitle = data.title || "";
        state.brand = data.brand || "";
        state.model = data.model || "";
        document.getElementById("price").value = data.price || "";
        document.getElementById("color").value = data.color || "";
        document.getElementById("size").value = data.size || "";
        document.getElementById("quantity").value = data.quantity || 1;
      }
    } catch (_err) {
      // 抽出不可（ストアページ等）。空欄のまま編集可能。
    }
  }

  const saved = await loadSavedTitle(state.asin);
  const titleEl = document.getElementById("title");
  if (saved) {
    titleEl.value = saved;
    document.getElementById("saved-badge").hidden = false;
  } else {
    titleEl.value = state.originalTitle;
  }

  document.getElementById("copy-btn").addEventListener("click", onCopy);
  document.getElementById("shorten-btn").addEventListener("click", onShorten);
  document.getElementById("model-btn").addEventListener("click", onApplyModel);
  document.getElementById("revert-btn").addEventListener("click", onRevert);
}

function onShorten() {
  const el = document.getElementById("title");
  el.value = shortenTitle(el.value);
}

function onApplyModel() {
  if (!state.model) {
    setStatus("型番が見つかりません", true);
    return;
  }
  const base = state.originalTitle || document.getElementById("title").value;
  const built = buildModelTitle(base, state.brand, state.model);
  if (built) {
    document.getElementById("title").value = built;
    setStatus("");
  }
}

async function onRevert() {
  document.getElementById("title").value = state.originalTitle;
  document.getElementById("saved-badge").hidden = true;
  await deleteSavedTitle(state.asin);
  setStatus("");
}

async function onCopy() {
  const title = document.getElementById("title").value.trim();
  const text = formatOutput({
    title,
    color: document.getElementById("color").value.trim(),
    size: document.getElementById("size").value.trim(),
    price: document.getElementById("price").value.trim(),
    quantity: document.getElementById("quantity").value.trim(),
    url: document.getElementById("url").value.trim()
  });

  try {
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました");

    if (state.asin && title && title !== state.originalTitle) {
      await saveTitle(state.asin, title);
      document.getElementById("saved-badge").hidden = false;
    }
  } catch (_err) {
    setStatus("コピーに失敗しました", true);
  }
}

init();
