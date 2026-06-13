/** Short two-tone chime for new chat messages (no external audio file). */

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Call once after user interaction so autoplay policies allow sound. */
export function unlockChatAudio() {
  const ctx = getAudioContext();
  if (!ctx || audioUnlocked) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  audioUnlocked = true;
}

export function playChatMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.12);
    playTone(1174.66, now + 0.1, 0.18);
  } catch {
    /* ignore audio errors */
  }
}

export async function requestChatNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Notification.permission;
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showChatBrowserNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(opts.title, {
      body: opts.body.slice(0, 180),
      tag: opts.tag ?? "pawps-team-chat",
      icon: "/pawps-logo.png",
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch {
    /* ignore */
  }
}

export function truncateChatPreview(text: string, max = 90) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
