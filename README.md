# Immersive Translate Lite

A lightweight Chrome Manifest V3 bilingual translation extension.

It keeps the original page text and inserts translated text below each paragraph, similar to an immersive bilingual reading workflow.

## Features

- OpenAI-compatible LLM translation
- Built-in presets for DeepSeek V4 Pro, Doubao, Kimi, Qwen, and Gemini
- Free translation service presets for Google Translate, Microsoft Translator, MyMemory, and LibreTranslate-compatible endpoints
- Custom request template mode for your own model gateway
- Per-site auto-translate domain list
- Keyboard shortcut toggle, default `Alt+D`
- Popup and context menu toggle

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder: `immersive-translate-lite`.
5. Open the extension options page and configure your provider.

## Keyboard Shortcut

The default command is `Alt+D`. Chrome commonly uses `Alt+D` for focusing the address bar, so confirm the shortcut after loading the extension:

1. Open `chrome://extensions/shortcuts`.
2. Find `Immersive Translate Lite`.
3. Change `Toggle bilingual translation on the current page`.

The popup and options page both include a Keyboard Shortcuts button that opens Chrome's shortcuts page.

## Provider Presets

### OpenAI Compatible

- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4.1-mini`
- Requires API Key: yes

### DeepSeek V4 Pro

- Endpoint: `https://api.deepseek.com/chat/completions`
- Model: `deepseek-v4-pro`
- Requires API Key: yes

For `deepseek-v4-pro`, the extension can send:

```json
{
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```

### Doubao / Volcano Ark

- Endpoint: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- Model preset: `doubao-seed-1-6-250615`
- Requires API Key: yes

Some Volcano Ark accounts use endpoint IDs as the `model` value. Replace the model in options if your account requires that.

### Kimi / Moonshot

- Endpoint: `https://api.moonshot.cn/v1/chat/completions`
- Model preset: `moonshot-v1-8k`
- Requires API Key: yes

### Qwen / DashScope

- Endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- Model preset: `qwen-plus`
- Requires API Key: yes

### Gemini OpenAI-compatible

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- Model preset: `gemini-2.5-flash`
- Requires API Key: yes

## Free Translation Services

These providers do not require an API key in the extension, but they can be rate-limited, unavailable, or changed by the service operator.

- Google Translate Free: `https://translate.googleapis.com/translate_a/single`
- Microsoft Translator Free: `https://www.bing.com/translator`
- MyMemory Free: `https://api.mymemory.translated.net/get`
- LibreTranslate-compatible: `https://libretranslate.com/translate`

For free services, set:

- Target Language Code: for example `zh-CN`, `en`, `ja`, `ko`
- Source Language Code: `auto` when supported, or a concrete code such as `en`

MyMemory does not reliably support `auto`; the extension falls back to `en` when source is set to `auto`.

Microsoft Translator Free uses Bing Translator's web token flow. It is not an official stable API and may break when Bing changes its page scripts.

## Custom Request Template

Choose `Custom Template` to send requests to your own gateway. Available variables:

- `{{model}}`
- `{{targetLanguage}}`
- `{{textsJson}}`
- `{{prompt}}`

Example:

```json
{
  "model": "{{model}}",
  "input": "{{prompt}}"
}
```

The response parser tries common shapes such as:

- `translations`
- `data.translations`
- `output_text`
- `text`
- `choices[0].message.content`

For chat-completions responses, the model should return a JSON string array, for example:

```json
["Translation 1", "Translation 2"]
```
