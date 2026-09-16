const DEFAULT_CARRIER_OPTIONS = [
  { name: 'Jabil', color: '#2563eb' },
  { name: 'Перевізник 2', color: '#16a34a' },
  { name: 'Перевізник 3', color: '#f97316' },
  { name: 'Перевізник 4', color: '#dc2626' },
  { name: 'Перевізник 5', color: '#9333ea' }
];

const CARRIER_STORAGE_KEY = 'facilitypeople.carrier-options';
const CARRIER_ALIAS_STORAGE_KEY = 'facilitypeople.carrier-aliases';
const PERSON_META_STORAGE_KEY = 'facilitypeople.person-metadata';

function loadCarrierOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(CARRIER_STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length === DEFAULT_CARRIER_OPTIONS.length) {
      return saved.map((item, index) => ({
        name: String(item.name || DEFAULT_CARRIER_OPTIONS[index].name).trim(),
        color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : DEFAULT_CARRIER_OPTIONS[index].color
      }));
    }
  } catch (error) {
    console.warn('Не вдалося завантажити налаштування перевізників:', error);
  }
  return DEFAULT_CARRIER_OPTIONS.map(item => ({ ...item }));
}

window.CARRIER_OPTIONS = loadCarrierOptions();
try {
  const storedAliases = JSON.parse(localStorage.getItem(CARRIER_ALIAS_STORAGE_KEY) || '{}');
  window.CARRIER_ALIASES = storedAliases && typeof storedAliases === 'object' ? storedAliases : {};
} catch (error) {
  window.CARRIER_ALIASES = {};
}

function saveCarrierOptions() {
  localStorage.setItem(CARRIER_STORAGE_KEY, JSON.stringify(window.CARRIER_OPTIONS));
}

function saveCarrierAliases() {
  localStorage.setItem(CARRIER_ALIAS_STORAGE_KEY, JSON.stringify(window.CARRIER_ALIASES));
}

function getPersonMetaStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(PERSON_META_STORAGE_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch (error) {
    return {};
  }
}

function getPersonMetaKey(person) {
  if (person && person.id) return `id:${person.id}`;
  return `row:${String(person && person.name || '').trim()}|${String(person && person.city || '').trim()}|${String(person && person.shift || '').trim()}`;
}

window.savePersonMetadata = function savePersonMetadata(person, metadata) {
  const store = getPersonMetaStore();
  store[getPersonMetaKey(person)] = {
    carrier: metadata.carrier,
    color: metadata.color
  };
  localStorage.setItem(PERSON_META_STORAGE_KEY, JSON.stringify(store));
};

window.applyPersonMetadata = function applyPersonMetadata(people) {
  const store = getPersonMetaStore();
  return people.map(person => {
    const metadata = store[getPersonMetaKey(person)];
    return metadata ? { ...person, ...metadata } : person;
  });
};

window.savePersonRecord = async function savePersonRecord(db, tableName, person, editingId = null) {
  const fullPayload = {
    name: person.name,
    city: person.city,
    shift: person.shift,
    carrier: person.carrier,
    color: person.color
  };
  const legacyPayload = {
    name: person.name,
    city: person.city,
    shift: person.shift
  };

  let result = editingId
    ? await db.from(tableName).update(fullPayload).eq('id', editingId).select()
    : await db.from(tableName).insert([fullPayload]).select();
  let usedLegacySchema = false;
  const errorText = result.error ? String(result.error.message || result.error) : '';
  const schemaError = result.error && (result.error.status === 400 || result.error.code === 'PGRST204' || /column|schema/i.test(errorText));

  if (schemaError) {
    usedLegacySchema = true;
    result = editingId
      ? await db.from(tableName).update(legacyPayload).eq('id', editingId).select()
      : await db.from(tableName).insert([legacyPayload]).select();
  }

  if (!result.error) {
    const savedPerson = Array.isArray(result.data) && result.data[0]
      ? result.data[0]
      : { ...person, id: editingId };
    window.savePersonMetadata(savedPerson, person);
  }

  return { ...result, usedLegacySchema };
};

function escapeCarrierHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

window.getCarrierOption = function getCarrierOption(name) {
  const requested = String(name || '').trim().toLowerCase();
  const direct = window.CARRIER_OPTIONS.find(item => item.name.toLowerCase() === requested);
  if (direct) return direct;
  const alias = window.CARRIER_ALIASES[requested];
  return window.CARRIER_OPTIONS.find(item => item.name.toLowerCase() === String(alias || '').toLowerCase())
    || window.CARRIER_OPTIONS[0];
};

window.getCarrierOptionsHtml = function getCarrierOptionsHtml(selectedName) {
  const selected = String(selectedName || 'Jabil').trim().toLowerCase();
  return window.CARRIER_OPTIONS.map(item =>
    `<option value="${escapeCarrierHtml(item.name)}" data-color="${item.color}"${item.name.toLowerCase() === selected ? ' selected' : ''}>${escapeCarrierHtml(item.name)}</option>`
  ).join('');
};

window.saveCarrierColor = function saveCarrierColor(name, color) {
  const carrier = window.getCarrierOption(name);
  if (!/^#[0-9a-f]{6}$/i.test(color)) return carrier;
  carrier.color = color;
  saveCarrierOptions();
  return carrier;
};

window.renameCarrier = function renameCarrier(name, nextName) {
  const carrier = window.getCarrierOption(name);
  const previousName = carrier.name;
  const normalized = String(nextName || '').trim();
  if (!normalized) {
    alert('Назва перевізника не може бути порожньою.');
    return null;
  }

  const duplicate = window.CARRIER_OPTIONS.some(item =>
    item !== carrier && item.name.toLowerCase() === normalized.toLowerCase()
  );
  if (duplicate) {
    alert('Такий перевізник уже існує.');
    return null;
  }

  carrier.name = normalized;
  window.CARRIER_ALIASES[previousName.toLowerCase()] = carrier.name;
  saveCarrierOptions();
  saveCarrierAliases();
  return carrier;
};

window.bindCarrierEditor = function bindCarrierEditor(select, colorInput, renameButton) {
  if (!select || select.dataset.carrierEditorBound === '1') return;
  select.dataset.carrierEditorBound = '1';

  const syncColor = () => {
    const carrier = window.getCarrierOption(select.value);
    if (colorInput) colorInput.value = carrier.color;
  };

  select.addEventListener('change', syncColor);
  if (colorInput) {
    colorInput.addEventListener('change', () => {
      window.saveCarrierColor(select.value, colorInput.value);
    });
  }
  if (renameButton) {
    renameButton.addEventListener('click', () => {
      if (renameButton.dataset.editing === '1') {
        const input = select.parentElement.querySelector('.carrier-name-input');
        const carrier = window.renameCarrier(select.value, input && input.value);
        if (!carrier) return;
        select.innerHTML = window.getCarrierOptionsHtml(carrier.name);
        select.disabled = false;
        renameButton.dataset.editing = '0';
        renameButton.textContent = '✎';
        renameButton.title = 'Перейменувати перевізника';
        const cancelButton = select.parentElement.querySelector('.carrier-cancel-btn');
        if (cancelButton) cancelButton.remove();
        if (input) input.remove();
        syncColor();
        return;
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'carrier-name-input';
      input.value = select.value;
      input.setAttribute('aria-label', 'Нова назва перевізника');
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'carrier-cancel-btn';
      cancelButton.textContent = '×';
      cancelButton.title = 'Скасувати перейменування';
      select.parentElement.insertBefore(input, renameButton);
      select.parentElement.insertBefore(cancelButton, renameButton);
      select.disabled = true;
      renameButton.dataset.editing = '1';
      renameButton.textContent = '✓';
      renameButton.title = 'Зберегти назву перевізника';
      input.focus();
      input.select();

      const cancelEditing = () => {
        select.disabled = false;
        renameButton.dataset.editing = '0';
        renameButton.textContent = '✎';
        renameButton.title = 'Перейменувати перевізника';
        input.remove();
        cancelButton.remove();
      };
      cancelButton.addEventListener('click', cancelEditing, { once: true });
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') cancelEditing();
        if (event.key === 'Enter') renameButton.click();
      });
    });
  }
  syncColor();
};
