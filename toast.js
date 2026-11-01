import OBR from '@owlbear-rodeo/sdk';
import './style.css';
import { safeImage, DATA, CONTROL, createSelfConnectionProbe } from './security.js';

const session = new URLSearchParams(location.search).get('session');
const DISPLAY_MS = 4300;
const EXIT_MS = 380;
const MAX_VISIBLE = 3;
const queued = [];
const seen = new Set();

let visible = 0;
let closing = false;

const root = document.querySelector('#app');
document.body.className = 'toast-body';
root.className = 'toast-stack';

function send(type) {
  return OBR.broadcast.sendMessage(CONTROL, { session, type }, { destination: 'ALL' });
}

function createCard(item) {
  const card = document.createElement('article');
  card.className = `toast-card ${item.reaction === 'approves' ? 'is-approve' : 'is-disapprove'}`;

  const avatar = document.createElement('div');
  avatar.className = 'toast-avatar';

  if (item.image) {
    const imageUrl = safeImage(item.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => image.remove();
      avatar.append(image);
    }
  }

  const fallback = document.createElement('span');
  fallback.textContent = (item.name || '?').slice(0, 1).toUpperCase();
  avatar.append(fallback);

  const text = document.createElement('div');
  text.className = 'toast-copy';

  const name = document.createElement('div');
  name.className = 'toast-name';
  name.textContent = item.name || 'Без имени';

  const reaction = document.createElement('div');
  reaction.className = 'toast-reaction';
  reaction.textContent = item.reaction;

  text.append(name, reaction);
  card.append(avatar, text);
  return card;
}

function pump() {
  if (closing) return;

  while (visible < MAX_VISIBLE && queued.length > 0) {
    const item = queued.shift();
    const card = createCard(item);
    visible += 1;
    root.append(card);

    setTimeout(() => {
      card.classList.add('leaving');
      setTimeout(() => {
        card.remove();
        visible -= 1;
        pump();
      }, EXIT_MS);
    }, DISPLAY_MS);
  }

  if (visible === 0 && queued.length === 0 && !closing) {
    closing = true;
    setTimeout(() => {
      if (queued.length === 0 && visible === 0) {
        send('empty').catch(console.error);
      } else {
        closing = false;
        pump();
      }
    }, 250);
  }
}

function enqueue(items) {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if (!item || !['approves', 'disapproves'].includes(item.reaction) || typeof item.name !== 'string') continue;
    const id = String(item.id || '');
    if (!id || seen.has(id)) continue;

    seen.add(id);
    if (seen.size > 500) seen.clear();
    queued.push(item);
  }

  closing = false;
  pump();
}

OBR.onReady(() => {
  const getOwnConnection = createSelfConnectionProbe(OBR);

  OBR.broadcast.onMessage(DATA, ({ data, connectionId }) => {
    const ownConnectionId = getOwnConnection();
    if (ownConnectionId && connectionId === ownConnectionId && data?.session === session) {
      enqueue(data.items);
    }
  });

  for (const delay of [150, 500, 1100]) {
    setTimeout(() => send('ready').catch(console.error), delay);
  }
});
