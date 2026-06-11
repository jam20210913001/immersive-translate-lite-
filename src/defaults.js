export const DEFAULT_SETTINGS = {
  provider: "openai",
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4.1-mini",
  reasoningEffort: "high",
  thinkingMode: "enabled",
  targetLanguage: "简体中文",
  autoTranslateDomains: [],
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
  }
};

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
