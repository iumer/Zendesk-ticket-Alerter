# Zendesk Ticket Alerter (Chrome extension)

A small Chrome extension that checks Zendesk through the API and alerts you when a **new, unassigned** ticket comes in, with a desktop notification and a doorbell sound.

Built for small support teams (including those on lower Zendesk plans) where new tickets can sit unassigned while you're busy with other work.

## Features

- Polls the Zendesk Search API on an interval you choose (default 60s)
- Desktop notification + doorbell sound for each new unassigned ticket
- Click a notification to open the ticket in Zendesk
- The first check after turning it on only records what's already waiting, so you don't get flooded with old tickets
- Watching on/off switch in the popup, plus "Check now", "Test check" and "Test doorbell"

## Install

1. Download or clone this repo
2. Open `chrome://extensions` in Chrome
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select this folder
5. Pin the extension so its icon is visible in the toolbar

## Setup

1. Click the extension icon → **Settings**
2. Fill in:
   - **Zendesk subdomain**: the `yourcompany` part of `yourcompany.zendesk.com`
   - **Agent email**: the email you log in to Zendesk with
   - **API token**: Zendesk Admin Center → Apps and integrations → APIs → Zendesk API → Add API token
   - **Poll interval**: in seconds (minimum 30)
3. Click **Save**, then **Test check** to confirm it can reach Zendesk
4. Allow notifications when Chrome asks
5. Open the popup and switch **Watching** on

## How it works

The extension runs a background service worker that, on each interval, searches for:

```
type:ticket status:new assignee:none
```

Any ticket ID it hasn't seen before triggers a notification and the doorbell (played from an offscreen document, since service workers can't play audio).

## Privacy

- Your API token and settings are stored only in your own Chrome profile (`chrome.storage`)
- The extension only talks to `https://<your-subdomain>.zendesk.com`
- Nothing is sent anywhere else, and there is no tracking

Never commit your API token or share screenshots that show it.

## Notes

- Chrome may limit very short intervals (about 30s for unpacked extensions, 60s for published ones)
- Chrome puts extension service workers to sleep when idle; alarms wake them up again
- If "Last check" in the popup looks stale, open the popup or click **Check now**
