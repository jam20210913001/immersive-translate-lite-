# Immersive Translate Lite

一个可本地加载的 Chrome Manifest V3 双语翻译扩展原型，支持：

- 使用 OpenAI-compatible API 或自定义请求模板
- 配置 API endpoint、model、API key、目标语言
- 设置自动翻译的网站域名
- 使用快捷键切换当前页面翻译
- 原文保留，在段落下方插入译文

## 安装

1. 打开 Chrome：`chrome://extensions`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本目录：`immersive-translate-lite`
5. 打开扩展的“选项”页，填写你的模型接口配置

## 快捷键

默认命令是 `Alt+T`。如果被系统或浏览器占用：

1. 打开 `chrome://extensions/shortcuts`
2. 找到 `Immersive Translate Lite`
3. 修改 `Toggle bilingual translation on the current page`

## OpenAI-compatible 示例

- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4.1-mini`
- API Key: 你的 key
- Provider: `OpenAI Compatible`

接口需要返回类似：

```json
{
  "choices": [
    {
      "message": {
        "content": "[\"译文 1\", \"译文 2\"]"
      }
    }
  ]
}
```

扩展会要求模型只返回 JSON 字符串数组。

## 自定义请求模板

Provider 选择 `Custom Template` 后，请求体会使用你的模板。可用变量：

- `{{model}}`
- `{{targetLanguage}}`
- `{{textsJson}}`
- `{{prompt}}`

模板示例：

```json
{
  "model": "{{model}}",
  "input": "{{prompt}}"
}
```

自定义接口的响应解析会尽量兼容常见字段：`translations`、`data.translations`、`output_text`、`text`、`choices[0].message.content`。
