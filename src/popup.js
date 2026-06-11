const status = document.getElementById("status");

document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const response = await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATION" }).catch((error) => ({
    ok: false,
    error: error.message
  }));
  status.textContent = response?.ok === false ? response.error : "Translation command sent";
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("shortcuts").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
