import {
  DEFAULT_SETTINGS,
  FREE_TRANSLATION_PROVIDERS,
  PROVIDER_PRESETS,
  normalizeDomain
} from "./defaults.js";

const fields = [
  "provider",
  "endpoint",
  "apiKey",
  "model",
  "targetLanguage",
  "targetLanguageCode",
  "sourceLanguageCode",
  "batchSize",
  "thinkingMode",
  "reasoningEffort",
  "requestTemplate"
];

const elements = Object.fromEntries(
  [
    "autoTranslateDomains",
    "save",
    "status",
    "templateSection",
    "deepseekSection",
    "apiKeyLabel",
    "modelLabel",
    "providerNote",
    ...fields
  ].map((id) => [id, document.getElementById(id)])
);

const providerNotes = {
  openai: "Use any OpenAI-compatible chat completions endpoint.",
  deepseek: "Uses DeepSeek chat completions with optional thinking controls.",
  doubao: "Uses Volcano Ark's OpenAI-compatible chat completions endpoint. Replace the model if your Ark account uses endpoint IDs.",
  kimi: "Uses Moonshot/Kimi's OpenAI-compatible endpoint.",
  qwen: "Uses Alibaba DashScope compatible-mode endpoint.",
  gemini: "Uses Gemini's OpenAI-compatible endpoint. API key is required.",
  google_free: "No API key. Uses an unofficial public Google Translate endpoint and may be rate-limited or changed.",
  microsoft_free: "No API key. Uses Bing Translator's web token flow and may be rate-limited or changed.",
  mymemory_free: "No API key. MyMemory may require a concrete source language; auto falls back to en.",
  libretranslate_free: "No API key by default, but many LibreTranslate instances require one. You can replace the endpoint.",
  custom: "Use a JSON request template with {{model}}, {{targetLanguage}}, {{textsJson}}, and {{prompt}}."
};

loadSettings();
elements.provider.addEventListener("change", applyProviderPreset);
elements.save.addEventListener("click", saveSettings);

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  fields.forEach((field) => {
    elements[field].value = settings[field] ?? DEFAULT_SETTINGS[field] ?? "";
  });
  elements.autoTranslateDomains.value = (settings.autoTranslateDomains || []).join("\n");
  syncProviderUi();
}

async function saveSettings() {
  const autoTranslateDomains = elements.autoTranslateDomains.value
    .split(/\r?\n/)
    .map(normalizeDomain)
    .filter(Boolean);

  const settings = {
    provider: elements.provider.value,
    endpoint: elements.endpoint.value.trim(),
    apiKey: elements.apiKey.value.trim(),
    model: elements.model.value.trim(),
    targetLanguage: elements.targetLanguage.value.trim() || DEFAULT_SETTINGS.targetLanguage,
    targetLanguageCode: elements.targetLanguageCode.value.trim() || DEFAULT_SETTINGS.targetLanguageCode,
    sourceLanguageCode: elements.sourceLanguageCode.value.trim() || DEFAULT_SETTINGS.sourceLanguageCode,
    batchSize: Number(elements.batchSize.value || DEFAULT_SETTINGS.batchSize),
    thinkingMode: elements.thinkingMode.value,
    reasoningEffort: elements.reasoningEffort.value,
    requestTemplate: elements.requestTemplate.value,
    autoTranslateDomains: Array.from(new Set(autoTranslateDomains))
  };

  await chrome.storage.sync.set(settings);
  elements.status.textContent = "Saved";
  setTimeout(() => {
    elements.status.textContent = "";
  }, 1800);
}

function applyProviderPreset() {
  const preset = PROVIDER_PRESETS[elements.provider.value];
  if (preset) {
    elements.endpoint.value = preset.endpoint;
    elements.model.value = preset.model;
  }
  syncProviderUi();
}

function syncProviderUi() {
  const provider = elements.provider.value;
  const isFree = FREE_TRANSLATION_PROVIDERS.has(provider);
  elements.templateSection.hidden = provider !== "custom";
  elements.deepseekSection.hidden = provider !== "deepseek";
  elements.apiKeyLabel.hidden = isFree;
  elements.modelLabel.hidden = isFree;
  elements.providerNote.textContent = providerNotes[provider] || "";
}
