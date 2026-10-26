const subdomainEl = document.getElementById("subdomain");
const emailEl = document.getElementById("email");
const apiTokenEl = document.getElementById("apiToken");
const pollIntervalSecEl = document.getElementById("pollIntervalSec");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const testSoundBtn = document.getElementById("testSound");
const resetSeenBtn = document.getElementById("resetSeen");
const msgEl = document.getElementById("msg");

init();

saveBtn.addEventListener("click", async () => {
  await saveSettings();
  showMsg("Saved.");
});

testBtn.addEventListener("click", async () => {
  await saveSettings();
  showMsg("Saved. Running check…");
  const status = await chrome.runtime.sendMessage({ type: "POLL_NOW" });
  if (status?.lastError) {
    showMsg(status.lastError, true);
  } else {
    showMsg(
      `OK. Open New/unassigned matches: ${status.lastMatchCount ?? 0}. ` +
        `First baseline seed does not ring; later new tickets will.`
    );
  }
});

async function saveSettings() {
  const pollIntervalSec = clampInterval(Number(pollIntervalSecEl.value));
  await chrome.storage.sync.set({
    subdomain: subdomainEl.value.trim().replace(/\.zendesk\.com$/i, ""),
    email: emailEl.value.trim(),
    apiToken: apiTokenEl.value.trim(),
    pollIntervalSec
  });
  pollIntervalSecEl.value = String(pollIntervalSec);
}

testSoundBtn.addEventListener("click", async () => {
  showMsg("Playing doorbell…");
  await chrome.runtime.sendMessage({ type: "TEST_SOUND" });
});

resetSeenBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "RESET_SEEN" });
  showMsg("Seen-ticket memory cleared. Next check will re-seed without ringing.");
});

async function init() {
  const data = await chrome.storage.sync.get({
    subdomain: "",
    email: "",
    apiToken: "",
    pollIntervalSec: 60
  });
  subdomainEl.value = data.subdomain || "";
  emailEl.value = data.email || "";
  apiTokenEl.value = data.apiToken || "";
  pollIntervalSecEl.value = String(data.pollIntervalSec || 60);
}

function clampInterval(value) {
  if (!Number.isFinite(value)) return 60;
  return Math.min(3600, Math.max(30, Math.round(value)));
}

function showMsg(text, isError = false) {
  msgEl.hidden = false;
  msgEl.textContent = text;
  msgEl.classList.toggle("error", isError);
}
