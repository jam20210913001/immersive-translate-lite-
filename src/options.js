import { DEFAULT_SETTINGS, normalizeDomain } from "./defaults.js";

const fields = [
  "provider",
  "endpoint",
  "apiKey",
  "model",
  "targetLanguage",
  "batchSize",
  "requestTemplate"
];

const elements = Object.fromEntries(
  ["autoTranslateDomains", "save", "status", "templateSection", ...fields].map((id) => [id, document.getElementById(id)])
);

loadSettings();
elements.provider.addEventListener("change", syncTemplateVisibility);
elements.save.addEventListener("click", saveSettings);

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  fields.forEach((field) => {
    elements[field].value = settings[field] ?? DEFAULT_SETTINGS[field] ?? "";
  });
  elements.autoTranslateDomains.value = (settings.autoTranslateDomains || []).join("\n");
  syncTemplateVisibility();
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
    batchSize: Number(elements.batchSize.value || DEFAULT_SETTINGS.batchSize),
    requestTemplate: elements.requestTemplate.value,
    autoTranslateDomains: Array.from(new Set(autoTranslateDomains))
  };

  await chrome.storage.sync.set(settings);
  elements.status.textContent = "已保存";
  setTimeout(() => {
    elements.status.textContent = "";
  }, 1800);
}

function syncTemplateVisibility() {
  elements.templateSection.hidden = elements.provider.value !== "custom";
}
