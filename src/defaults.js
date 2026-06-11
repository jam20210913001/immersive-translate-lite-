export const DEFAULT_SETTINGS = {
  provider: "openai",
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4.1-mini",
  reasoningEffort: "high",
  thinkingMode: "enabled",
  sourceLanguageCode: "auto",
  targetLanguage: "\u7b80\u4f53\u4e2d\u6587",
  targetLanguageCode: "zh-CN",
  autoTranslateDomains: [],
  neverTranslateDomains: [],
  neverTranslateLanguageCodes: [],
  selectionTranslateEnabled: true,
  hoverTranslateEnabled: false,
  hoverTriggerKey: "ctrl",
  batchSize: 18,
  requestTemplate: "{\n  \"model\": \"{{model}}\",\n  \"input\": \"{{prompt}}\"\n}"
};

export const PROVIDER_PRESETS = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-pro"
  },
  doubao: {
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    model: "doubao-seed-1-6-250615"
  },
  kimi: {
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k"
  },
  qwen: {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus"
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash"
  },
  google_free: {
    endpoint: "https://translate.googleapis.com/translate_a/single",
    model: ""
  },
  microsoft_free: {
    endpoint: "https://www.bing.com/translator",
    model: ""
  },
  mymemory_free: {
    endpoint: "https://api.mymemory.translated.net/get",
    model: ""
  },
  libretranslate_free: {
    endpoint: "https://libretranslate.com/translate",
    model: ""
  }
};

export const LLM_PROVIDERS = new Set([
  "openai",
  "deepseek",
  "doubao",
  "kimi",
  "qwen",
  "gemini"
]);

export const FREE_TRANSLATION_PROVIDERS = new Set([
  "google_free",
  "microsoft_free",
  "mymemory_free",
  "libretranslate_free"
]);

export function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

export function domainMatches(hostname, patterns) {
  const host = normalizeDomain(hostname);
  return patterns
    .map(normalizeDomain)
    .filter(Boolean)
    .some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}
