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

  maybeAutoTranslate();

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
      const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
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

  function clearTranslations() {
    document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll(`[${DONE_ATTR}]`).forEach((element) => {
      element.removeAttribute(DONE_ATTR);
      element.classList.remove("itl-translating");
    });
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
