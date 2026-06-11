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
  "requestTemplate",
  "hoverTriggerKey"
];

const checkboxes = [
  "selectionTranslateEnabled",
  "hoverTranslateEnabled"
];

const elements = Object.fromEntries(
  [
    "autoTranslateDomains",
    "neverTranslateDomains",
    "save",
    "shortcuts",
    "controlPanel",
    "status",
    "templateSection",
    "deepseekSection",
    "apiKeyRow",
    "modelRow",
    "pageTitle",
    "clearCache",
    "resetSettings",
    "uiLanguage",
    ...fields,
    ...checkboxes
  ].map((id) => [id, document.getElementById(id)])
);

const titles = {
  basic: "\u57fa\u672c\u8bbe\u7f6e",
  selection: "\u5212\u8bcd\u7ffb\u8bd1",
  hover: "\u9f20\u6807\u60ac\u505c"
};

loadSettings();

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchPanel(tab.dataset.panel));
});

elements.provider.addEventListener("change", applyProviderPreset);
elements.save.addEventListener("click", saveSettings);
elements.clearCache.addEventListener("click", () => setStatus("\u7f13\u5b58\u5df2\u6e05\u9664"));
elements.resetSettings.addEventListener("click", resetSettings);
elements.shortcuts.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
elements.controlPanel.addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") });
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  fields.forEach((field) => {
    elements[field].value = settings[field] ?? DEFAULT_SETTINGS[field] ?? "";
  });
  checkboxes.forEach((field) => {
    elements[field].checked = Boolean(settings[field]);
  });
  elements.autoTranslateDomains.value = (settings.autoTranslateDomains || []).join("\n");
  elements.neverTranslateDomains.value = (settings.neverTranslateDomains || []).join("\n");
  elements.uiLanguage.value = settings.uiLanguage || "zh-CN";
  syncProviderUi();
}

async function saveSettings() {
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
    hoverTriggerKey: elements.hoverTriggerKey.value,
    selectionTranslateEnabled: elements.selectionTranslateEnabled.checked,
    hoverTranslateEnabled: elements.hoverTranslateEnabled.checked,
    uiLanguage: elements.uiLanguage.value,
    autoTranslateDomains: uniqueDomains(elements.autoTranslateDomains.value),
    neverTranslateDomains: uniqueDomains(elements.neverTranslateDomains.value)
  };

  await chrome.storage.sync.set(settings);
  setStatus("\u5df2\u4fdd\u5b58");
}

async function resetSettings() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  await loadSettings();
  setStatus("\u5df2\u91cd\u7f6e");
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
  elements.apiKeyRow.hidden = isFree;
  elements.modelRow.hidden = isFree;
}

function switchPanel(panelId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === panelId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  elements.pageTitle.textContent = titles[panelId] || titles.basic;
}

function uniqueDomains(value) {
  return Array.from(new Set(
    String(value || "")
      .split(/\r?\n/)
      .map(normalizeDomain)
      .filter(Boolean)
  ));
}

function setStatus(message) {
  elements.status.textContent = message;
  setTimeout(() => {
    if (elements.status.textContent === message) elements.status.textContent = "";
  }, 1800);
}
