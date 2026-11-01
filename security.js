export const CHANNEL = 'com.companion-approval.reaction';
export const CONTROL = 'com.companion-approval.toast-control';
export const DATA = 'com.companion-approval.toast-data';
export const PROBE = 'com.companion-approval.self-check';

const MAX_NAME_LENGTH = 120;
const MAX_IMAGE_LENGTH = 2048;
const LOCAL_HOST = /^(localhost|.+\.localhost|.+\.local)$/i;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function safeImage(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IMAGE_LENGTH) return '';

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (LOCAL_HOST.test(url.hostname) || IPV4.test(url.hostname) || url.hostname.includes(':')) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function safeReaction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!['approves', 'disapproves'].includes(value.reaction)) return null;
  if (typeof value.name !== 'string') return null;

  const name = value.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return null;
  if (typeof value.nonce !== 'string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(value.nonce)) return null;

  return {
    id: value.nonce,
    name,
    reaction: value.reaction,
    image: safeImage(value.image),
  };
}

export class RateLimiter {
  constructor(max = 5, windowMs = 2000) {
    this.max = max;
    this.windowMs = windowMs;
    this.events = new Map();
  }

  allow(key) {
    const now = Date.now();
    const timestamps = (this.events.get(key) || []).filter((time) => now - time < this.windowMs);

    if (timestamps.length >= this.max) {
      this.events.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.events.set(key, timestamps);

    if (this.events.size > 100) {
      for (const [id, list] of this.events) {
        if (list.length === 0 || now - list[list.length - 1] > this.windowMs) this.events.delete(id);
      }
    }

    return true;
  }
}

export async function isGMConnection(OBR, connectionId, ownConnectionId) {
  if (!connectionId || !ownConnectionId) return false;
  if (connectionId === ownConnectionId) return (await OBR.player.getRole()) === 'GM';

  const players = await OBR.party.getPlayers();
  return players.some((player) => player.connectionId === connectionId && player.role === 'GM');
}

export function createSelfConnectionProbe(OBR) {
  let ownConnectionId = null;
  const nonce = `probe_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  OBR.broadcast.onMessage(PROBE, (event) => {
    if (event?.data?.nonce === nonce && typeof event.connectionId === 'string') {
      ownConnectionId = event.connectionId;
    }
  });

  OBR.broadcast.sendMessage(PROBE, { nonce }, { destination: 'LOCAL' }).catch(console.error);
  return () => ownConnectionId;
}
