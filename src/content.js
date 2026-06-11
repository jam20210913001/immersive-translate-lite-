(function () {
  const TRANSLATION_CLASS = "itl-translation";
  const DONE_ATTR = "data-itl-translated";
  const MIN_TEXT_LENGTH = 12;
  const BLOCK_SELECTOR = [
    "p",
    "li",
    "blockquote",
    "figcaption",
    "article h1",
    "article h2",
    "article h3",
    "article h4",
    "main h1",
    "main h2",
    "main h3",
    "main h4",
    "section h1",
    "section h2",
    "section h3",
    "section h4"
  ].join(",");

  let translating = false;
  let settingsCache = null;
  let selectionButton = null;
  let floatingPanel = null;
  let hoverTimer = null;
  const pressedKeys = new Set();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TOGGLE_TRANSLATION") {
      toggleTranslation().then(
        () => sendResponse({ ok: true }),
        (error) => sendResponse({ ok: false, error: error.message || String(error) })
      );
      return true;
    }
    return false;
  });

  document.addEventListener("mouseup", handleSelectionMouseup, true);
  document.addEventListener("mousedown", handleDocumentMousedown, true);
  document.addEventListener("mouseover", handleHover, true);
  document.addEventListener("keydown", (event) => pressedKeys.add(event.key.toLowerCase()), true);
  document.addEventListener("keyup", (event) => pressedKeys.delete(event.key.toLowerCase()), true);

  maybeAutoTranslate();

  async function getSettings() {
    if (!settingsCache) {
      settingsCache = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }).catch(() => ({}));
      setTimeout(() => {
        settingsCache = null;
      }, 3000);
    }
    return settingsCache || {};
  }

  async function maybeAutoTranslate() {
    const response = await chrome.runtime.sendMessage({
      type: "SHOULD_AUTO_TRANSLATE",
      hostname: location.hostname
    }).catch(() => null);

    if (response?.shouldTranslate) {
      await translatePage();
    }
  }

  async function toggleTranslation() {
    if (document.querySelector(`.${TRANSLATION_CLASS}`)) {
      clearTranslations();
      return;
    }
    await translatePage();
  }

  async function translatePage() {
    if (translating) return;
    translating = true;

    try {
      const settings = await getSettings();
      const batchSize = Math.max(1, Number(settings?.batchSize || 18));
      const targets = collectTargets();

      for (let index = 0; index < targets.length; index += batchSize) {
        const batch = targets.slice(index, index + batchSize);
        batch.forEach(({ element }) => setPlaceholder(element, "Translating...", "itl-loading"));

        const response = await chrome.runtime.sendMessage({
          type: "TRANSLATE_BATCH",
          texts: batch.map(({ text }) => text)
        });

        if (!response?.ok) {
          batch.forEach(({ element }) => setPlaceholder(element, response?.error || "Translation failed.", "itl-error"));
          continue;
        }

        batch.forEach(({ element }, batchIndex) => {
          insertTranslation(element, response.translations[batchIndex] || "");
        });
      }
    } finally {
      translating = false;
    }
  }

  function collectTargets() {
    return Array.from(document.querySelectorAll(BLOCK_SELECTOR))
      .filter(isVisible)
      .filter((element) => !element.closest("script, style, nav, footer, header, aside, textarea, input, select, button"))
      .filter((element) => !element.hasAttribute(DONE_ATTR))
      .map((element) => ({ element, text: normalizeText(element.innerText) }))
      .filter(({ text }) => text.length >= MIN_TEXT_LENGTH)
      .filter(({ text }) => !looksLikeCode(text))
      .slice(0, 240);
  }

  function setPlaceholder(element, text, extraClass) {
    removeNextTranslation(element);
    const translation = document.createElement("span");
    translation.className = `${TRANSLATION_CLASS} ${extraClass}`;
    translation.textContent = text;
    element.insertAdjacentElement("afterend", translation);
    element.classList.add("itl-translating");
  }

  function insertTranslation(element, text) {
    removeNextTranslation(element);
    const translation = document.createElement("span");
    translation.className = TRANSLATION_CLASS;
    translation.textContent = text;
    element.insertAdjacentElement("afterend", translation);
    element.setAttribute(DONE_ATTR, "true");
    element.classList.remove("itl-translating");
  }

  async function handleSelectionMouseup() {
    const settings = await getSettings();
    if (!settings.selectionTranslateEnabled) return;

    const selection = window.getSelection();
    const text = normalizeText(selection?.toString() || "");
    if (text.length < 2 || text.length > 1200) {
      hideSelectionButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showSelectionButton(text, rect);
  }

  function showSelectionButton(text, rect) {
    hideSelectionButton();
    selectionButton = document.createElement("button");
    selectionButton.className = "itl-selection-button";
    selectionButton.type = "button";
    selectionButton.textContent = "\u7ffb\u8bd1";
    selectionButton.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
    selectionButton.style.top = `${Math.max(8, rect.bottom + window.scrollY + 8)}px`;
    selectionButton.addEventListener("mousedown", (event) => event.preventDefault());
    selectionButton.addEventListener("click", async () => {
      showFloatingPanel("Translating...", rect, "loading");
      const translated = await translateOne(text);
      showFloatingPanel(translated, rect);
      hideSelectionButton();
    });
    document.documentElement.appendChild(selectionButton);
  }

  async function handleHover(event) {
    const settings = await getSettings();
    if (!settings.hoverTranslateEnabled || !hoverKeyMatches(settings.hoverTriggerKey)) return;

    const target = event.target?.closest?.(BLOCK_SELECTOR);
    if (!target || !isVisible(target) || target.hasAttribute(DONE_ATTR)) return;

    const text = normalizeText(target.innerText);
    if (text.length < MIN_TEXT_LENGTH || text.length > 1200 || looksLikeCode(text)) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      const rect = target.getBoundingClientRect();
      showFloatingPanel("Translating...", rect, "loading");
      const translated = await translateOne(text);
      showFloatingPanel(translated, rect);
    }, 280);
  }

  function hoverKeyMatches(key) {
    const normalized = String(key || "ctrl").toLowerCase();
    if (normalized === "none") return true;
    if (normalized === "ctrl") return pressedKeys.has("control");
    if (normalized === "alt") return pressedKeys.has("alt");
    if (normalized === "shift") return pressedKeys.has("shift");
    return true;
  }

  async function translateOne(text) {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_BATCH",
      texts: [text]
    }).catch((error) => ({ ok: false, error: error.message }));
    if (!response?.ok) return response?.error || "Translation failed.";
    return response.translations?.[0] || "";
  }

  function showFloatingPanel(text, rect, state = "") {
    hideFloatingPanel();
    floatingPanel = document.createElement("div");
    floatingPanel.className = `itl-floating-panel ${state ? `itl-floating-${state}` : ""}`;
    floatingPanel.textContent = text;
    floatingPanel.style.left = `${Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 340)}px`;
    floatingPanel.style.top = `${window.scrollY + rect.bottom + 10}px`;
    document.documentElement.appendChild(floatingPanel);
  }

  function handleDocumentMousedown(event) {
    if (event.target?.closest?.(".itl-selection-button, .itl-floating-panel")) return;
    hideSelectionButton();
    hideFloatingPanel();
  }

  function clearTranslations() {
    document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll(`[${DONE_ATTR}]`).forEach((element) => {
      element.removeAttribute(DONE_ATTR);
      element.classList.remove("itl-translating");
    });
  }

  function hideSelectionButton() {
    selectionButton?.remove();
    selectionButton = null;
  }

  function hideFloatingPanel() {
    floatingPanel?.remove();
    floatingPanel = null;
  }

  function removeNextTranslation(element) {
    const next = element.nextElementSibling;
    if (next?.classList?.contains(TRANSLATION_CLASS)) {
      next.remove();
    }
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function looksLikeCode(text) {
    const codeSignals = (text.match(/[{}();=<>]/g) || []).length;
    return codeSignals > 12 && codeSignals / Math.max(text.length, 1) > 0.04;
  }
})();
