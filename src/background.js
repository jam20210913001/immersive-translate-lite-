import { DEFAULT_SETTINGS, FREE_TRANSLATION_PROVIDERS, domainMatches } from "./defaults.js";

const MENU_ID = "toggle-translation";

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...existing });
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Toggle bilingual translation",
    contexts: ["page"]
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-translation") {
    await sendToActiveTab({ type: "TOGGLE_TRANSLATION" });
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_ID) {
    await sendToActiveTab({ type: "TOGGLE_TRANSLATION" });
  }
});

chrome.action.onClicked.addListener(async () => {
  await sendToActiveTab({ type: "TOGGLE_TRANSLATION" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }

  if (message?.type === "SHOULD_AUTO_TRANSLATE") {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then((settings) => {
      const neverTranslate = domainMatches(message.hostname, settings.neverTranslateDomains || []);
      sendResponse({
        shouldTranslate: !neverTranslate && domainMatches(message.hostname, settings.autoTranslateDomains || [])
      });
    });
    return true;
  }

  if (message?.type === "TRANSLATE_BATCH") {
    translateBatch(message.texts || []).then(
      (translations) => sendResponse({ ok: true, translations }),
      (error) => sendResponse({ ok: false, error: error.message || String(error) })
    );
    return true;
  }

  return false;
});

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, message).catch(async () => {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
    await chrome.tabs.sendMessage(tab.id, message);
  });
}

async function translateBatch(texts) {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (!Array.isArray(texts) || texts.length === 0) return [];

  if (FREE_TRANSLATION_PROVIDERS.has(settings.provider)) {
    return translateWithFreeService(texts, settings);
  }

  if (!settings.endpoint) {
    throw new Error("Please configure an API endpoint in extension options.");
  }

  const prompt = buildPrompt(texts, settings.targetLanguage);
  const requestBody = settings.provider === "custom"
    ? renderTemplate(settings.requestTemplate, {
        model: settings.model,
        targetLanguage: settings.targetLanguage,
        textsJson: JSON.stringify(texts),
        prompt
      })
    : JSON.stringify(buildChatCompletionBody(settings, prompt));

  let body;
  try {
    body = JSON.parse(requestBody);
  } catch {
    throw new Error("Custom request template is not valid JSON after variable replacement.");
  }

  const headers = { "Content-Type": "application/json" };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;

  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Translation API failed: ${response.status} ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  const translations = parseTranslations(data);
  if (!Array.isArray(translations)) {
    throw new Error("Could not parse translations from API response.");
  }

  return texts.map((_, index) => String(translations[index] || ""));
}

function buildPrompt(texts, targetLanguage) {
  return [
    `Translate the following JSON array into ${targetLanguage || "\u7b80\u4f53\u4e2d\u6587"}.`,
    "Return only a JSON string array. Do not add markdown, explanations, numbering, or extra keys.",
    JSON.stringify(texts)
  ].join("\n\n");
}

function buildChatCompletionBody(settings, prompt) {
  const body = {
    model: settings.model,
    messages: [
      {
        role: "system",
        content: "You are a precise translation engine. Return only a JSON string array. Keep array length and order unchanged."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2,
    stream: false
  };

  if (settings.provider === "deepseek" && settings.model === "deepseek-v4-pro") {
    body.thinking = { type: settings.thinkingMode || "enabled" };
    body.reasoning_effort = settings.reasoningEffort || "high";
  }

  return body;
}

async function translateWithFreeService(texts, settings) {
  const translations = [];
  for (const text of texts) {
    if (settings.provider === "google_free") {
      translations.push(await translateGoogleFree(text, settings));
    } else if (settings.provider === "microsoft_free") {
      translations.push(await translateMicrosoftFree(text, settings));
    } else if (settings.provider === "mymemory_free") {
      translations.push(await translateMyMemoryFree(text, settings));
    } else if (settings.provider === "libretranslate_free") {
      translations.push(await translateLibreTranslate(text, settings));
    }
  }
  return translations;
}

async function translateGoogleFree(text, settings) {
  const target = normalizeGoogleLanguage(settings.targetLanguageCode);
  const source = normalizeGoogleLanguage(settings.sourceLanguageCode || "auto");
  const url = new URL(settings.endpoint || "https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const data = await fetchJson(url.toString());
  return String((data?.[0] || []).map((part) => part?.[0] || "").join(""));
}

async function translateMicrosoftFree(text, settings) {
  const target = normalizeMicrosoftLanguage(settings.targetLanguageCode);
  const source = normalizeMicrosoftLanguage(settings.sourceLanguageCode || "");
  const credentials = await getBingTranslatorCredentials(settings.endpoint);
  const url = new URL("https://www.bing.com/ttranslatev3");
  url.searchParams.set("isVertical", "1");
  if (credentials.ig) url.searchParams.set("IG", credentials.ig);
  if (credentials.iid) url.searchParams.set("IID", credentials.iid);

  const body = new URLSearchParams();
  body.set("fromLang", source && source !== "auto" ? source : "auto-detect");
  body.set("to", target);
  body.set("text", text);
  body.set("token", credentials.token);
  body.set("key", credentials.key);
  body.set("tryFetchingGenderDebiasedTranslations", "true");

  const data = await fetchJson(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  return String(data?.[0]?.translations?.[0]?.text || data?.[0]?.translations?.[0]?.displayTarget || "");
}

async function translateMyMemoryFree(text, settings) {
  const target = normalizeGenericLanguage(settings.targetLanguageCode);
  const source = normalizeGenericLanguage(settings.sourceLanguageCode) === "auto"
    ? "en"
    : normalizeGenericLanguage(settings.sourceLanguageCode);
  const url = new URL(settings.endpoint || "https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|${target}`);

  const data = await fetchJson(url.toString());
  return String(data?.responseData?.translatedText || "");
}

async function translateLibreTranslate(text, settings) {
  const target = normalizeLibreLanguage(settings.targetLanguageCode);
  const source = normalizeLibreLanguage(settings.sourceLanguageCode || "auto");
  const data = await fetchJson(settings.endpoint || "https://libretranslate.com/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: "text"
    })
  });
  return String(data?.translatedText || "");
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Translation service failed: ${response.status} ${detail.slice(0, 240)}`);
  }
  return response.json();
}

async function getBingTranslatorCredentials(endpoint) {
  const home = endpoint || "https://www.bing.com/translator";
  const response = await fetch(home);
  if (!response.ok) {
    throw new Error(`Could not load Bing Translator: ${response.status}`);
  }

  const html = await response.text();
  const paramsMatch = html.match(/params_RichTranslateHelper\s*=\s*(\[[^\]]+\])/);
  if (!paramsMatch) {
    throw new Error("Could not find Bing Translator token.");
  }

  let params;
  try {
    params = JSON.parse(paramsMatch[1]);
  } catch {
    throw new Error("Could not parse Bing Translator token.");
  }

  const ig = html.match(/IG:"([^"]+)"/)?.[1] || html.match(/"IG":"([^"]+)"/)?.[1] || "";
  const iid = html.match(/data-iid="([^"]+)"/)?.[1] || "translator.5028";
  return {
    key: String(params[0] || ""),
    token: String(params[1] || ""),
    ig,
    iid
  };
}

function normalizeGenericLanguage(value) {
  return String(value || "auto").trim() || "auto";
}

function normalizeGoogleLanguage(value) {
  const language = normalizeGenericLanguage(value);
  if (language.toLowerCase() === "zh-cn") return "zh-CN";
  if (language.toLowerCase() === "zh-tw") return "zh-TW";
  return language;
}

function normalizeMicrosoftLanguage(value) {
  const language = normalizeGenericLanguage(value);
  if (language.toLowerCase() === "zh-cn") return "zh-Hans";
  if (language.toLowerCase() === "zh-tw") return "zh-Hant";
  return language;
}

function normalizeLibreLanguage(value) {
  const language = normalizeGenericLanguage(value);
  if (language.toLowerCase() === "zh-cn") return "zh";
  return language.split("-")[0];
}

function renderTemplate(template, values) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key] ?? "";
    return key.endsWith("Json") ? value : String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  });
}

function parseTranslations(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.translations)) return data.translations;
  if (Array.isArray(data?.data?.translations)) return data.data.translations;

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.output_text ||
    data?.text ||
    data?.data?.output_text;

  if (!content) return null;
  const trimmed = String(content).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}
