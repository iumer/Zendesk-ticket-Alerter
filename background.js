const ALARM_NAME = "zd-poll";
const SYNC_DEFAULTS = {
  enabled: false,
  subdomain: "",
  email: "",
  apiToken: "",
  pollIntervalSec: 60
};
const LOCAL_DEFAULTS = {
  seenTicketIds: [],
  watchInitialized: false,
  lastCheckAt: null,
  lastError: null,
  lastMatchCount: 0
};

chrome.runtime.onInstalled.addListener(async () => {
  const sync = await chrome.storage.sync.get(null);
  const local = await chrome.storage.local.get(null);
  await chrome.storage.sync.set({ ...SYNC_DEFAULTS, ...sync });
  await chrome.storage.local.set({ ...LOCAL_DEFAULTS, ...local });
  await syncAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncAlarm();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "sync" && (changes.enabled || changes.pollIntervalSec)) {
    if (changes.enabled?.newValue === true && changes.enabled?.oldValue === false) {
      // Fresh enable: don't alert on tickets already waiting in the queue.
      await chrome.storage.local.set({ watchInitialized: false });
    }
    await syncAlarm();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await pollTickets();
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith("zd-ticket-")) return;
  const ticketId = notificationId.replace("zd-ticket-", "");
  const { subdomain } = await getSync();
  await chrome.tabs.create({
    url: `https://${subdomain}.zendesk.com/agent/tickets/${ticketId}`
  });
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handled by offscreen.js
  if (message?.type === "PLAY_BELL") return false;

  (async () => {
    if (message?.type === "POLL_NOW") {
      await pollTickets({ force: true });
      sendResponse(await getStatus());
      return;
    }
    if (message?.type === "GET_STATUS") {
      sendResponse(await getStatus());
      return;
    }
    if (message?.type === "RESET_SEEN") {
      await chrome.storage.local.set({
        seenTicketIds: [],
        watchInitialized: false
      });
      sendResponse(await getStatus());
      return;
    }
    if (message?.type === "TEST_SOUND") {
      await playBell();
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});

async function getSync() {
  return chrome.storage.sync.get(SYNC_DEFAULTS);
}

async function getLocal() {
  return chrome.storage.local.get(LOCAL_DEFAULTS);
}

async function getStatus() {
  return { ...(await getSync()), ...(await getLocal()) };
}

async function syncAlarm() {
  const { enabled, pollIntervalSec } = await getSync();
  await chrome.alarms.clear(ALARM_NAME);

  if (!enabled) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  // Chrome allows ~30s for unpacked extensions; 1 min minimum when published.
  const minutes = Math.max(0.5, Number(pollIntervalSec || 60) / 60);
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: minutes,
    delayInMinutes: 0.05
  });
  await chrome.action.setBadgeText({ text: "ON" });
  await chrome.action.setBadgeBackgroundColor({ color: "#0B7A3E" });
  await pollTickets();
}

async function pollTickets({ force = false } = {}) {
  const sync = await getSync();
  const local = await getLocal();
  if (!sync.enabled && !force) return;

  const { subdomain, email, apiToken } = sync;
  if (!subdomain || !email || !apiToken) {
    await chrome.storage.local.set({
      lastCheckAt: new Date().toISOString(),
      lastError: "Missing subdomain, email, or API token. Open Settings."
    });
    return;
  }

  const query = encodeURIComponent("type:ticket status:new assignee:none");
  const url = `https://${subdomain}.zendesk.com/api/v2/search.json?query=${query}&sort_by=created_at&sort_order=desc`;

  try {
    const auth = btoa(`${email}/token:${apiToken}`);
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Zendesk API ${res.status}: ${body.slice(0, 180)}`);
    }

    const data = await res.json();
    const tickets = (data.results || []).filter((t) => t.id != null);
    const currentIds = tickets.map((t) => String(t.id));
    const seen = new Set((local.seenTicketIds || []).map(String));

    let newTickets = [];
    if (!local.watchInitialized) {
      // Seed baseline so existing New/unassigned tickets don't all ring at once.
      newTickets = [];
    } else {
      newTickets = tickets.filter((t) => !seen.has(String(t.id)));
    }

    for (const ticket of newTickets) {
      await alertNewTicket(ticket, subdomain);
    }

    const nextSeen = Array.from(new Set([...currentIds, ...seen])).slice(0, 500);
    await chrome.storage.local.set({
      seenTicketIds: nextSeen,
      watchInitialized: true,
      lastCheckAt: new Date().toISOString(),
      lastError: null,
      lastMatchCount: currentIds.length
    });
  } catch (err) {
    await chrome.storage.local.set({
      lastCheckAt: new Date().toISOString(),
      lastError: err?.message || String(err)
    });
  }
}

async function alertNewTicket(ticket, subdomain) {
  const id = String(ticket.id);
  const title = ticket.subject || `Ticket #${id}`;

  await chrome.notifications.create(`zd-ticket-${id}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "New unassigned Zendesk ticket",
    message: `#${id}: ${title}`,
    contextMessage: `${subdomain}.zendesk.com · New · Unassigned`,
    priority: 2,
    requireInteraction: true
  });

  await playBell();
}

async function playBell() {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: "PLAY_BELL" });
  } catch {
    // Keep notification even if audio fails.
  }
}

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument) {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play alert bell when a new unassigned Zendesk ticket is detected."
  });
}
