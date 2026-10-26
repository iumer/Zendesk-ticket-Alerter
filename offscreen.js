chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PLAY_BELL") return;
  playDoorBell()
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

/**
 * Classic loud ding-dong doorbell.
 * Edit frequencies / repeats here to change the sound.
 */
async function playDoorBell() {
  const ctx = new AudioContext();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  // Keep headroom under 1.0 to avoid harsh clipping, but make it punchy.
  master.gain.value = 0.95;
  master.connect(ctx.destination);

  // Classic doorbell: high "ding", lower "dong"
  const DING = 784.0; // G5
  const DONG = 523.25; // C5
  const pattern = [
    { freq: DING, at: 0.0 },
    { freq: DONG, at: 0.42 },
    // Second ring so it's harder to miss
    { freq: DING, at: 1.15 },
    { freq: DONG, at: 1.57 }
  ];

  for (const note of pattern) {
    strikeBell(ctx, master, note.freq, now + note.at);
  }

  await new Promise((r) => setTimeout(r, 2800));
  await ctx.close();
}

function strikeBell(ctx, destination, freq, start) {
  const duration = 1.05;

  // Fundamental + partials = metallic doorbell character
  const partials = [
    { ratio: 1, gain: 1.0, type: "sine" },
    { ratio: 2.0, gain: 0.45, type: "sine" },
    { ratio: 3.01, gain: 0.22, type: "triangle" },
    { ratio: 4.1, gain: 0.1, type: "sine" }
  ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p.type;
    osc.frequency.value = freq * p.ratio;

    // Sharp attack, long decay (door chime)
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(p.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}
