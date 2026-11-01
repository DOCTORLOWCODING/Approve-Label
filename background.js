import OBR from '@owlbear-rodeo/sdk';
import {
  CHANNEL,
  CONTROL,
  DATA,
  RateLimiter,
  safeReaction,
  createSelfConnectionProbe,
  isGMConnection,
} from './security.js';

const POPOVER_ID = 'com.companion-approval.toast';
const limiter = new RateLimiter(5, 2000);
const seen = new Set();

let currentSession = null;
let opening = false;
let ready = false;
let pending = [];

function createSessionId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function deliver(items) {
  if (!currentSession || !ready || items.length === 0) return;
  await OBR.broadcast.sendMessage(DATA, { session: currentSession, items }, { destination: 'LOCAL' });
}

async function openToast() {
  if (opening || !currentSession) return;
  opening = true;

  try {
    const toastUrl = new URL(`${import.meta.env.BASE_URL}toast.html`, window.location.origin);
    toastUrl.searchParams.set('session', currentSession);

    await OBR.popover.open({
      id: POPOVER_ID,
      url: toastUrl.href,
      width: 400,
      height: 370,
      anchorReference: 'POSITION',
      anchorPosition: { left: 99999, top: 70 },
      anchorOrigin: { horizontal: 'RIGHT', vertical: 'TOP' },
      transformOrigin: { horizontal: 'RIGHT', vertical: 'TOP' },
      hidePaper: true,
      disableClickAway: true,
    });
  } catch (error) {
    console.error('Approve Label: cannot open toast', error);
    for (const item of pending) {
      OBR.notification.show(`${item.name} ${item.reaction}`);
    }
    pending = [];
    currentSession = null;
    ready = false;
  } finally {
    opening = false;
  }
}

OBR.onReady(() => {
  const getOwnConnection = createSelfConnectionProbe(OBR);

  OBR.broadcast.onMessage(CHANNEL, async ({ data, connectionId }) => {
    try {
      if (!(await isGMConnection(OBR, connectionId, getOwnConnection()))) return;

      const item = safeReaction(data);
      if (!item || !limiter.allow(connectionId) || seen.has(item.id)) return;

      seen.add(item.id);
      if (seen.size > 500) seen.clear();

      if (!currentSession) currentSession = createSessionId();

      if (!ready) {
        pending.push(item);
        if (pending.length > 40) pending.shift();
        await openToast();
      } else {
        await deliver([item]);
      }
    } catch (error) {
      console.error('Approve Label: reaction rejected', error);
    }
  });

  OBR.broadcast.onMessage(CONTROL, async ({ data, connectionId }) => {
    const ownConnectionId = getOwnConnection();
    if (!ownConnectionId || connectionId !== ownConnectionId || !data || data.session !== currentSession) return;

    if (data.type === 'ready') {
      ready = true;
      const batch = pending;
      pending = [];
      await deliver(batch);
      return;
    }

    if (data.type === 'empty') {
      ready = false;
      const closingSession = currentSession;
      currentSession = null;
      try {
        await OBR.popover.close(POPOVER_ID);
      } catch {
        // The popover may already be closed.
      }
      if (currentSession && currentSession !== closingSession) await openToast();
    }
  });
});
