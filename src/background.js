import { DEFAULT_SETTINGS, domainMatches } from "./defaults.js";

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
      sendResponse({
        shouldTranslate: domainMatches(message.hostname, settings.autoTranslateDomains || [])
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
  if (!settings.endpoint) {
    throw new Error("Please configure an API endpoint in extension options.");
  }
  if (!Array.isArray(texts) || texts.length === 0) return [];

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
    `Translate the following JSON array into ${targetLanguage || "简体中文"}.`,
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
