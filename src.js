import OBR, { isImage } from '@owlbear-rodeo/sdk';
import './style.css';
import { safeImage } from './security.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main>
    <h1>Approve Label</h1>
    <div id="controls" hidden>
      <label class="form-label" for="token">Токен на сцене</label>
      <select id="token"></select>
      <button class="secondary" id="refresh" type="button">Обновить список</button>
      <button class="secondary" id="selected-token" type="button">Взять выделенный токен</button>
      <div class="selected" id="preview"></div>
      <div class="pair">
        <button class="yes" id="yes" type="button">✓ Approves</button>
        <button class="no" id="no" type="button">✕ Disapproves</button>
      </div>
    </div>
    <div class="status" id="status" role="status" aria-live="polite">Подключение к Owlbear Rodeo…</div>
  </main>
`;

const $ = (id) => document.getElementById(id);
let characters = [];

function setStatus(message) {
  $('status').textContent = message;
}

function currentCharacter() {
  return characters.find((item) => item.id === $('token').value);
}

function renderSelectedCharacter() {
  const item = currentCharacter();
  const container = $('preview');
  container.replaceChildren();

  if (!item) {
    container.textContent = 'Выберите токен';
    return;
  }

  const imageUrl = safeImage(item.image?.url);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    container.append(image);
  }

  const name = document.createElement('strong');
  name.textContent = item.name || 'Без имени';
  container.append(name);
}

function showCharacters(items) {
  const previousId = $('token').value;
  const source = Array.isArray(items) ? items : [];

  characters = source
    .filter((item) => item?.layer === 'CHARACTER' && isImage(item))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

  const select = $('token');
  select.replaceChildren();

  for (const item of characters) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name || 'Без имени';
    select.append(option);
  }

  if (characters.some((item) => item.id === previousId)) {
    select.value = previousId;
  }

  renderSelectedCharacter();
  $('yes').disabled = $('no').disabled = characters.length === 0;
}

async function refreshCharacters() {
  if (!(await OBR.scene.isReady())) {
    showCharacters([]);
    setStatus('Откройте сцену, чтобы выбрать токен.');
    return;
  }

  showCharacters(await OBR.scene.items.getItems());
  setStatus(`Доступно токенов: ${characters.length}`);
}

function createNonce() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function sendReaction(reaction) {
  const item = currentCharacter();
  if (!item) return;

  try {
    await OBR.broadcast.sendMessage(
      'com.companion-approval.reaction',
      {
        name: item.name || 'Без имени',
        image: safeImage(item.image?.url),
        reaction,
        nonce: createNonce(),
      },
      { destination: 'ALL' },
    );
    setStatus(`Отправлено: ${item.name || 'Без имени'} ${reaction}`);
  } catch (error) {
    setStatus(`Не удалось отправить: ${error instanceof Error ? error.message : 'ошибка'}`);
  }
}

OBR.onReady(async () => {
  try {
    if ((await OBR.player.getRole()) !== 'GM') {
      setStatus('Кнопки реакций доступны только мастеру.');
      return;
    }

    $('controls').hidden = false;
    await refreshCharacters();

    $('refresh').addEventListener('click', () => {
      refreshCharacters().catch((error) => setStatus(error.message));
    });

    $('token').addEventListener('change', renderSelectedCharacter);

    $('selected-token').addEventListener('click', async () => {
      try {
        const selection = await OBR.player.getSelection();
        const found = characters.find((item) => selection?.includes(item.id));
        if (found) {
          $('token').value = found.id;
          renderSelectedCharacter();
          setStatus(`Выбран: ${found.name || 'Без имени'}`);
        } else {
          setStatus('Выделите токен персонажа на сцене.');
        }
      } catch (error) {
        setStatus(`Не удалось получить выделение: ${error.message}`);
      }
    });

    $('yes').addEventListener('click', () => sendReaction('approves'));
    $('no').addEventListener('click', () => sendReaction('disapproves'));

    OBR.scene.items.onChange(showCharacters);
    OBR.scene.onReadyChange(() => {
      refreshCharacters().catch((error) => setStatus(error.message));
    });
  } catch (error) {
    setStatus(`Ошибка: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
  }
});
