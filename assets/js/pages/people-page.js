(() => {
const db = window.createAppDb();
const tables = window.getTenantTables();

let people = [];
let editingPersonId = null;
let settlementsList = null;
let personMiniMap = null;
let personPickMarker = null;
let lastSelectedSettlement = null;

const personCarrierSelect = document.getElementById('personCarrier');
const personColorInput = document.getElementById('personColor');
if (personCarrierSelect && typeof window.getCarrierOptionsHtml === 'function') {
  personCarrierSelect.innerHTML = window.getCarrierOptionsHtml('Jabil');
  window.bindCarrierEditor(
    personCarrierSelect,
    personColorInput,
    document.getElementById('renamePersonCarrier')
  );
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function refreshSettlementsFromDb() {
  if (!window.db || typeof window.db.from !== 'function') return settlementsList || [];

  try {
    const settlementTable = window.getTableName ? window.getTableName('settlements') : 'settlements';
    const { data: dbSettlements, error } = await window.db.from(settlementTable).select('*');
    if (error) {
      console.warn('Failed to refresh settlements from DB:', error.message || error);
      return settlementsList || [];
    }

    if (Array.isArray(dbSettlements)) {
      const merged = new Map();
      for (const item of settlementsList || []) {
        if (item && item.name) merged.set(normalizeText(item.name), item);
      }
      for (const item of dbSettlements) {
        if (item && item.name) merged.set(normalizeText(item.name), item);
      }
      settlementsList = Array.from(merged.values());
      if (typeof window !== 'undefined') {
        window.settlementsList = settlementsList;
      }
    }
  } catch (err) {
    console.warn('refreshSettlementsFromDb failed:', err);
  }

  return settlementsList || [];
}

async function ensureSettlementsLoaded() {
  if (Array.isArray(settlementsList) && settlementsList.length) return settlementsList;

  try {
    const res = await fetch('data/settlements.json');
    const localSettlements = await res.json();
    settlementsList = Array.isArray(localSettlements) ? localSettlements : [];
  } catch (err) {
    console.warn('Failed to load local settlements.json:', err);
    settlementsList = [];
  }

  if (window.db && typeof window.db.from === 'function') {
    try {
      const { data: dbSettlements, error } = await window.db.from(tables.settlements).select('*');
      if (!error && Array.isArray(dbSettlements)) {
        const merged = new Map();

        for (const item of settlementsList) {
          if (item && item.name) merged.set(normalizeText(item.name), item);
        }

        for (const item of dbSettlements) {
          if (item && item.name) merged.set(normalizeText(item.name), item);
        }

        settlementsList = Array.from(merged.values());
        window.settlementsList = settlementsList;
      } else if (error) {
        console.warn('No settlements table or access denied:', error.message || error);
      }
    } catch (dbErr) {
      console.warn('Failed to load settlements from DB:', dbErr);
    }
  }

  return settlementsList;
}

function findNearestSettlement(lat, lng) {
  if (!Array.isArray(settlementsList)) return null;

  let minDist = Infinity;
  let nearest = null;

  for (const s of settlementsList) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }

  if (minDist > 0.01) return null;
  return nearest;
}

function requestSettlementName() {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal active settlement-name-modal';
    modal.innerHTML = `
      <div class="modal-content settlement-name-dialog">
        <h2>Вкажіть населений пункт</h2>
        <p>Введіть правильну назву НП для збереження.</p>
        <input type="text" class="settlement-name-input" required autofocus>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary settlement-cancel-btn">Скасувати</button>
          <button type="button" class="btn btn-primary settlement-save-btn">Зберегти</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('.settlement-name-input');
    const close = value => {
      modal.remove();
      resolve(value);
    };

    modal.querySelector('.settlement-save-btn').addEventListener('click', () => {
      const name = input.value.trim();
      if (name) close(name);
    });
    modal.querySelector('.settlement-cancel-btn').addEventListener('click', () => close(null));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        modal.querySelector('.settlement-save-btn').click();
      }
      if (event.key === 'Escape') close(null);
    });
    input.focus();
  });
}

async function resolveSettlementFromClick(lat, lng) {
  const settlement = findNearestSettlement(lat, lng);

  let name;
  let finalLat = lat;
  let finalLng = lng;

  if (settlement) {
    if (confirm(`Це ${settlement.name}?`)) {
      name = settlement.name;
      finalLat = settlement.lat;
      finalLng = settlement.lng;
    }
  }

  if (!name) {
    name = await requestSettlementName();
    if (!name) return null;
  }

  return { name, lat: finalLat, lng: finalLng };
}

async function saveSettlementIfMissing(name, lat, lng) {
  const settlementName = String(name || '').trim();
  if (!settlementName) return null;

  const existing = (settlementsList || []).find(s => normalizeText(s.name) === normalizeText(settlementName));
  if (existing) return existing;

  const newSettlement = {
    name: settlementName,
    lat: Number(lat),
    lng: Number(lng)
  };

  settlementsList = [...(settlementsList || []), newSettlement];
  window.settlementsList = settlementsList;

  if (window.db && typeof window.db.from === 'function') {
    try {
      const { data: existingRows, error: checkError } = await window.db
        .from(tables.settlements)
        .select('id, name, lat, lng')
        .ilike('name', settlementName)
        .limit(1);

      if (checkError) {
        console.error('Settlement lookup failed:', checkError.message || checkError);
      }

      const existingInDb = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
      if (existingInDb) {
        settlementsList = (settlementsList || []).map(item =>
          normalizeText(item.name) === normalizeText(existingInDb.name) ? existingInDb : item
        );
        window.settlementsList = settlementsList;
        return existingInDb;
      }

      const { data, error } = await window.db
        .from(tables.settlements)
        .insert([{ name: settlementName, lat: Number(lat), lng: Number(lng) }])
        .select();

      if (!error && Array.isArray(data) && data.length) {
        const savedSettlement = data[0];
        settlementsList = (settlementsList || []).map(item =>
          normalizeText(item.name) === normalizeText(savedSettlement.name) ? savedSettlement : item
        );
        window.settlementsList = settlementsList;
        return savedSettlement;
      }

      if (error) {
        console.error('Settlement insert failed:', error.message || error);
      }
    } catch (dbErr) {
      console.error('Settlement save failed:', dbErr);
    }
  }

  return newSettlement;
}

function initPersonMiniMap() {
  if (personMiniMap) {
    personMiniMap.invalidateSize();
    return;
  }

  personMiniMap = L.map('personMiniMap').setView([48.6175, 22.2731], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(personMiniMap);

  personMiniMap.on('click', async (e) => {
    await ensureSettlementsLoaded();
    const selected = await resolveSettlementFromClick(e.latlng.lat, e.latlng.lng);
    if (!selected) return;

    if (!Number.isFinite(Number(selected.lat)) || !Number.isFinite(Number(selected.lng))) {
      alert('Не вдалося визначити координати населеного пункту. Виберіть точку на карті ще раз.');
      return;
    }

    lastSelectedSettlement = selected;

    const personCity = document.getElementById('personCity');
    personCity.value = selected.name;

    if (personPickMarker) {
      personMiniMap.removeLayer(personPickMarker);
    }

    personPickMarker = L.marker([Number(selected.lat), Number(selected.lng)]).addTo(personMiniMap)
      .bindPopup(selected.name)
      .openPopup();
  });
}

window.initBurgerMenu('burgerMenuBtn', 'burgerMenu');

async function loadPeople() {
  try {
    const res = await fetch('data/people.json');
    const jsonPeople = await res.json();
    const { data: dbPeople } = await db.from(tables.people).select('*');
    people = typeof window.applyPersonMetadata === 'function'
      ? window.applyPersonMetadata([...jsonPeople, ...(dbPeople || [])])
      : [...jsonPeople, ...(dbPeople || [])];
    renderPeople();
  } catch (err) {
    console.error('Error loading people:', err);
  }
}

function renderPeople() {
  const tbody = document.getElementById('peopleList');
  const searchBox = document.getElementById('searchBox');
  if (!tbody || !searchBox) return;
  const searchTerm = searchBox.value.toLowerCase();

  const filtered = people.filter(p => {
    const text = `${p.name} ${p.city} ${p.shift} ${p.carrier || 'Jabil'}`.toLowerCase();
    return text.includes(searchTerm);
  });

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.city}</td>
      <td>${p.shift}</td>
      <td>${p.carrier || 'Jabil'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" onclick="editPerson('${p.id}', '${p.name}', '${p.city}', '${p.shift}', '${p.carrier || 'Jabil'}', '${p.color || '#2563eb'}')">✏️ Редагувати</button>
          <button class="btn btn-danger" onclick="deletePerson('${p.id}')">🗑️ Видалити</button>
        </div>
      </td>
    </tr>
  `).join('');
}

const addPersonButton = document.getElementById('addPersonBtn');
if (addPersonButton) addPersonButton.addEventListener('click', () => {
  editingPersonId = null;
  lastSelectedSettlement = null;
  document.getElementById('modalTitle').textContent = 'Додати людину';
  document.getElementById('personName').value = '';
  document.getElementById('personCity').value = '';
  document.getElementById('personShift').value = 'A';
  document.getElementById('personCarrier').value = 'Jabil';
  document.getElementById('personColor').value = window.getCarrierOption('Jabil').color;
  document.getElementById('personMiniMapContainer').style.display = 'none';
  document.getElementById('editModal').classList.add('active');
});

window.editPerson = (id, name, city, shift, carrier, color) => {
  editingPersonId = id;
  document.getElementById('modalTitle').textContent = 'Редагувати людину';
  document.getElementById('personName').value = name;
  document.getElementById('personCity').value = city;
  document.getElementById('personShift').value = shift;
  document.getElementById('personCarrier').value = carrier || 'Jabil';
  document.getElementById('personColor').value = window.getCarrierOption(carrier || 'Jabil').color;
  document.getElementById('personMiniMapContainer').style.display = 'none';
  document.getElementById('editModal').classList.add('active');
};

const pickCityButton = document.getElementById('pickCityOnMapBtn');
if (pickCityButton) pickCityButton.addEventListener('click', async () => {
  await ensureSettlementsLoaded();
  const container = document.getElementById('personMiniMapContainer');
  container.style.display = 'block';
  initPersonMiniMap();
  if (personMiniMap) personMiniMap.invalidateSize();
});

const finishCityButton = document.getElementById('finishCityPickBtn');
if (finishCityButton) finishCityButton.addEventListener('click', () => {
  document.getElementById('personMiniMapContainer').style.display = 'none';
});

const personForm = document.getElementById('personForm');
if (personForm) personForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('personName').value.trim();
  const cityRaw = document.getElementById('personCity').value.trim();
  const shift = document.getElementById('personShift').value;
  const carrier = document.getElementById('personCarrier').value;
  const color = document.getElementById('personColor').value;

  if (!name || !cityRaw) {
    alert('Заповніть ім’я та населений пункт');
    return;
  }

  await ensureSettlementsLoaded();

  const match = (settlementsList || []).find(s => normalizeText(s.name) === normalizeText(cityRaw));
  let settlement = match || null;

  if (!settlement && lastSelectedSettlement && normalizeText(lastSelectedSettlement.name) === normalizeText(cityRaw)) {
    settlement = await saveSettlementIfMissing(lastSelectedSettlement.name, lastSelectedSettlement.lat, lastSelectedSettlement.lng);
  }

  if (!settlement) {
    alert('Такого Населеного пункту не знайдено. Спочатку виберіть його на карті або впишіть вірну назву.');
    return;
  }

  const city = settlement.name;

  try {
    const result = await window.savePersonRecord(
      db,
      tables.people,
      { name, city, shift, carrier, color },
      editingPersonId
    );
    if (result.error) throw result.error;
    document.getElementById('editModal').classList.remove('active');
    lastSelectedSettlement = null;
    await refreshSettlementsFromDb();
    await loadPeople();

    if (typeof window.loadAndDrawPeople === 'function' && typeof window.fetchAllPeople === 'function') {
      if (window._peopleCache) window._peopleCache = { ts: 0, data: null };
      const refreshedPeople = await window.fetchAllPeople(true);
      await window.loadAndDrawPeople(refreshedPeople);
    }
  } catch (err) {
    alert('Помилка: ' + err.message);
  }
});

const closeEditButton = document.getElementById('closeEditModal');
if (closeEditButton) closeEditButton.addEventListener('click', () => {
  document.getElementById('personMiniMapContainer').style.display = 'none';
  document.getElementById('editModal').classList.remove('active');
});

const cancelEditButton = document.getElementById('cancelEditBtn');
if (cancelEditButton) cancelEditButton.addEventListener('click', () => {
  document.getElementById('personMiniMapContainer').style.display = 'none';
  document.getElementById('editModal').classList.remove('active');
});

window.deletePerson = async (id) => {
  if (!confirm('Видалити людину?')) return;
  try {
    await db.from(tables.people).delete().eq('id', id);
    loadPeople();
  } catch (err) {
    alert('Помилка: ' + err.message);
  }
};

const searchBox = document.getElementById('searchBox');
if (searchBox) searchBox.addEventListener('input', renderPeople);

loadPeople();
})();
