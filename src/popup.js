import { DEFAULT_SETTINGS, PROVIDER_PRESETS } from "./defaults.js";

const providerLabels = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  doubao: "\u8c46\u5305",
  kimi: "Kimi",
  qwen: "\u5343\u95ee",
  gemini: "Gemini",
  google_free: "Google",
  microsoft_free: "Microsoft",
  mymemory_free: "MyMemory",
  libretranslate_free: "LibreTranslate",
  custom: "\u81ea\u5b9a\u4e49"
};

const elements = Object.fromEntries(
  [
    "provider",
    "mode",
    "pageMode",
    "translatePage",
    "configure",
    "sourceText",
    "translatedText",
    "options",
    "feedback",
    "pdf",
    "status",
    "sourceLabel",
    "targetLabel"
  ].map((id) => [id, document.getElementById(id)])
);

init();

async function init() {
  renderProviders();
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  elements.provider.value = settings.provider || DEFAULT_SETTINGS.provider;
  elements.sourceLabel.textContent = languageLabel(settings.sourceLanguageCode || "auto");
  elements.targetLabel.textContent = settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage;

  elements.provider.addEventListener("change", saveProvider);
  elements.translatePage.addEventListener("click", translateCurrentPage);
  elements.configure.addEventListener("click", openOptions);
  elements.options.addEventListener("click", openOptions);
  elements.feedback.addEventListener("click", openIssues);
  elements.pdf.addEventListener("click", () => setStatus("PDF translation is planned for a later version."));
  elements.sourceText.addEventListener("input", debounce(translateText, 550));
}

function renderProviders() {
  const providers = [...Object.keys(PROVIDER_PRESETS), "custom"];
  elements.provider.innerHTML = providers
    .map((provider) => `<option value="${provider}">${providerLabels[provider] || provider}</option>`)
    .join("");
}

async function saveProvider() {
  const preset = PROVIDER_PRESETS[elements.provider.value] || {};
  const update = { provider: elements.provider.value };
  if (preset.endpoint !== undefined) update.endpoint = preset.endpoint;
  if (preset.model !== undefined) update.model = preset.model;
  await chrome.storage.sync.set(update);
  setStatus("Provider saved");
}

async function translateCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const response = await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATION" }).catch((error) => ({
    ok: false,
    error: error.message
  }));
  setStatus(response?.ok === false ? response.error : "Translation command sent");
}

async function translateText() {
  const text = elements.sourceText.value.trim();
  if (!text) {
    elements.translatedText.value = "";
    return;
  }
  elements.translatedText.value = "Translating...";
  const response = await chrome.runtime.sendMessage({
    type: "TRANSLATE_BATCH",
    texts: [text]
  }).catch((error) => ({ ok: false, error: error.message }));
  elements.translatedText.value = response?.ok ? response.translations?.[0] || "" : response?.error || "Translation failed.";
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function openIssues() {
  await chrome.tabs.create({ url: "https://github.com/jam20210913001/immersive-translate-lite-/issues" });
}

function setStatus(message) {
  elements.status.textContent = message;
  setTimeout(() => {
    if (elements.status.textContent === message) elements.status.textContent = "";
  }, 2200);
}

function languageLabel(code) {
  const normalized = String(code || "auto").toLowerCase();
  if (normalized === "auto") return "\u82f1\u8bed";
  if (normalized.startsWith("zh")) return "\u4e2d\u6587";
  if (normalized.startsWith("ja")) return "\u65e5\u8bed";
  if (normalized.startsWith("ko")) return "\u97e9\u8bed";
  return code;
}

function debounce(callback, wait) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}
