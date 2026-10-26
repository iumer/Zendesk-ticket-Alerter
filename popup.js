const enabledEl = document.getElementById("enabled");
const stateText = document.getElementById("stateText");
const matchCount = document.getElementById("matchCount");
const lastCheck = document.getElementById("lastCheck");
const lastError = document.getElementById("lastError");
const checkNowBtn = document.getElementById("checkNow");
const openSettingsBtn = document.getElementById("openSettings");

init();

enabledEl.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabledEl.checked });
  await refresh();
});

checkNowBtn.addEventListener("click", async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.textContent = "Checking…";
  try {
    await chrome.runtime.sendMessage({ type: "POLL_NOW" });
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.textContent = "Check now";
    await refresh();
  }
});

openSettingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function init() {
  await refresh();
  setInterval(refresh, 3000);
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  enabledEl.checked = Boolean(status.enabled);
  stateText.textContent = status.enabled ? "Watching" : "Off";
  stateText.style.color = status.enabled ? "#1f9d55" : "#9aabba";
  matchCount.textContent =
    status.lastMatchCount == null ? "—" : String(status.lastMatchCount);
  lastCheck.textContent = status.lastCheckAt
    ? new Date(status.lastCheckAt).toLocaleTimeString()
    : "—";

  if (status.lastError) {
    lastError.hidden = false;
    lastError.textContent = status.lastError;
  } else {
    lastError.hidden = true;
    lastError.textContent = "";
  }
}
