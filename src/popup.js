const status = document.getElementById("status");

document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const response = await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATION" }).catch((error) => ({
    ok: false,
    error: error.message
  }));
  status.textContent = response?.ok === false ? response.error : "已发送翻译指令";
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
