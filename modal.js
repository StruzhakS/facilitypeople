// ===== ЗАВАНТАЖЕННЯ settlements =====
window.settlementsList = [];

function normalizeSettlementName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/і/g, 'и')
    .replace(/ї/g, 'и')
    .replace(/є/g, 'е')
    .replace(/\s+/g, '');
}

async function refreshSettlementsFromDb() {
  if (!window.db || typeof window.db.from !== 'function') return window.settlementsList;

  try {
    const tableName = window.getTableName ? window.getTableName('settlements') : 'settlements';
    const { data, error } = await window.db.from(tableName).select('*');
    if (error) {
      console.warn('Failed to load settlements from DB:', error.message || error);
      return window.settlementsList;
    }

    const merged = new Map();
    for (const item of Array.isArray(window.settlementsList) ? window.settlementsList : []) {
      if (item && item.name) merged.set(normalizeSettlementName(item.name), item);
    }
    for (const item of Array.isArray(data) ? data : []) {
      if (item && item.name) merged.set(normalizeSettlementName(item.name), item);
    }

    window.settlementsList = Array.from(merged.values());
    return window.settlementsList;
  } catch (err) {
    console.warn('refreshSettlementsFromDb failed:', err);
    return window.settlementsList;
  }
}

async function loadSettlementsList() {
  try {
    const r = await fetch('data/settlements.json');
    const list = await r.json();
    window.settlementsList = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Failed to load local settlements.json:', err);
    window.settlementsList = [];
  }

  await refreshSettlementsFromDb();
  return window.settlementsList;
}

loadSettlementsList();

// ===== HELPER: знайти найближчий НП =====
function findNearestSettlement(lat, lng) {
  if (!window.settlementsList) return null;

  let minDist = Infinity;
  let nearest = null;

  for (const s of window.settlementsList) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }

  if (minDist > 0.01) return null;
  return nearest;
}

let miniMap = null;
let personMiniMap = null;
let personPickMarker = null;

function resolveSettlementFromClick(lat, lng) {
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
    name = prompt('Введи назву НП');
    if (!name) return null;
  }

  return { name, lat: finalLat, lng: finalLng };
}

function initMiniMap() {
  if (miniMap) return;

  miniMap = L.map('miniMap').setView([48.6175, 22.2731], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(miniMap);

  miniMap.on('click', function (e) {
    if (!window.pickMode) return;

    const selected = resolveSettlementFromClick(e.latlng.lat, e.latlng.lng);
    if (!selected) return;

    if (!window.pickedStops.find(s => s.name === selected.name)) {
      window.pickedStops.push({
        name: selected.name,
        lat: selected.lat,
        lng: selected.lng
      });
      window.updatePickedStopsList();
    }
  });
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

  personMiniMap.on('click', function (e) {
    const selected = resolveSettlementFromClick(e.latlng.lat, e.latlng.lng);
    if (!selected) return;

    const personSettlementInput = document.getElementById('personSettlementInput');
    if (personSettlementInput) {
      personSettlementInput.value = selected.name;
    }

    if (personPickMarker) {
      personMiniMap.removeLayer(personPickMarker);
    }

    personPickMarker = L.marker([selected.lat, selected.lng]).addTo(personMiniMap)
      .bindPopup(selected.name)
      .openPopup();
  });
}

// ===== PICK MODE =====
window.pickMode = false;
window.pickedStops = [];
window.routeModalState = { mode: 'create', rowId: null };

const SCHEDULE_SHIFT_OPTIONS = ['A', 'B', 'C', 'D', 'Офіс'];

function parseTimeToMinutes(value) {
  const raw = String(value || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function diffMinutesForward(prevMinutes, nextMinutes) {
  if (prevMinutes == null || nextMinutes == null) return null;
  if (nextMinutes >= prevMinutes) return nextMinutes - prevMinutes;
  return (24 * 60 - prevMinutes) + nextMinutes;
}

function getRozivkaSettlement() {
  if (!Array.isArray(window.settlementsList)) return null;
  return window.settlementsList.find(s => String(s.name || '').toLowerCase() === 'розівка') || null;
}

function getDraftStopsWithRozivka() {
  const stops = [...window.pickedStops];
  const hasRozivka = stops.some(s => String(s.name || '').toLowerCase() === 'розівка');
  if (!hasRozivka) {
    const rozivka = getRozivkaSettlement();
    if (rozivka) {
      stops.push({ name: rozivka.name, lat: rozivka.lat, lng: rozivka.lng });
    }
  }
  return stops;
}

function sanitizeStopForStorage(stop) {
  if (!stop || typeof stop !== 'object') return null;
  const name = String(stop.name || '').trim();
  const lat = Number(stop.lat);
  const lng = Number(stop.lng);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { name, lat, lng };
}

function sanitizeRouteForStorage(route) {
  if (!route || typeof route !== 'object') return null;

  return {
    route_code: String(route.route_code || '').trim(),
    color: String(route.color || '#1976d2').trim(),
    type: String(route.type || 'shift').trim(),
    shifts: Array.isArray(route.shifts) ? route.shifts : [],
    schedule: Array.isArray(route.schedule) ? route.schedule : [],
    stops: (Array.isArray(route.stops) ? route.stops : []).map(sanitizeStopForStorage).filter(Boolean)
  };
}

function updateScheduleStopsHint() {
  const hint = document.getElementById('scheduleStopsHint');
  if (!hint) return;

  const stops = getDraftStopsWithRozivka();
  if (!stops.length) {
    hint.textContent = 'Зупинки для графіка: спочатку додайте/виберіть зупинки';
    return;
  }

  hint.textContent = `Порядок зупинок: ${stops.map(s => s.name).join(' -> ')}`;
}

function makeScheduleGroupElement(groupData = null) {
  const root = document.createElement('div');
  root.style.border = '1px solid #d1d5db';
  root.style.borderRadius = '8px';
  root.style.padding = '8px';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '6px';

  const shiftsLine = document.createElement('div');
  shiftsLine.style.display = 'flex';
  shiftsLine.style.flexWrap = 'wrap';
  shiftsLine.style.gap = '8px';
  shiftsLine.style.fontSize = '12px';
  shiftsLine.innerHTML = '<b style="margin-right:6px;">Група змін:</b>';

  const selectedShifts = new Set(Array.isArray(groupData && groupData.shifts) ? groupData.shifts : []);

  SCHEDULE_SHIFT_OPTIONS.forEach(shift => {
    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '4px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = shift;
    cb.name = 'schedule_group_shift';
    cb.checked = selectedShifts.has(shift);

    label.appendChild(cb);
    label.appendChild(document.createTextNode(shift));
    shiftsLine.appendChild(label);
  });

  const dayInput = document.createElement('input');
  dayInput.type = 'text';
  dayInput.name = 'schedule_day_times';
  dayInput.placeholder = 'День по зупинках: 05:05, 05:16, 05:23 ...';
  dayInput.style.width = '100%';
  dayInput.value = groupData && Array.isArray(groupData.stop_times_day) ? groupData.stop_times_day.join(', ') : '';

  const nightInput = document.createElement('input');
  nightInput.type = 'text';
  nightInput.name = 'schedule_night_times';
  nightInput.placeholder = 'Ніч по зупинках: 17:30, 17:41, 17:48 ...';
  nightInput.style.width = '100%';
  nightInput.value = groupData && Array.isArray(groupData.stop_times_night) ? groupData.stop_times_night.join(', ') : '';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Видалити групу';
  removeBtn.style.alignSelf = 'flex-end';
  removeBtn.addEventListener('click', () => root.remove());

  root.appendChild(shiftsLine);
  root.appendChild(dayInput);
  root.appendChild(nightInput);
  root.appendChild(removeBtn);
  return root;
}

function addScheduleGroup(groupData = null) {
  const container = document.getElementById('scheduleGroups');
  if (!container) return;
  container.appendChild(makeScheduleGroupElement(groupData));
}

function parseTimesCsv(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function buildSegmentsFromTimes(times) {
  if (!Array.isArray(times) || times.length < 2) return [];

  const segments = [];
  for (let i = 1; i < times.length; i++) {
    const prev = parseTimeToMinutes(times[i - 1]);
    const next = parseTimeToMinutes(times[i]);
    const diff = diffMinutesForward(prev, next);
    if (diff == null) return [];
    segments.push(diff);
  }

  return segments;
}

function collectScheduleFromEditor(stopsCount) {
  const groups = Array.from(document.querySelectorAll('#scheduleGroups > div'));
  const schedule = [];

  for (const group of groups) {
    const shifts = Array.from(group.querySelectorAll('input[name="schedule_group_shift"]:checked')).map(i => i.value);
    if (!shifts.length) continue;

    const dayRaw = group.querySelector('input[name="schedule_day_times"]');
    const nightRaw = group.querySelector('input[name="schedule_night_times"]');
    const dayTimes = parseTimesCsv(dayRaw ? dayRaw.value : '');
    const nightTimes = parseTimesCsv(nightRaw ? nightRaw.value : '');

    if (dayTimes.length && dayTimes.length !== stopsCount) {
      throw new Error(`Для групи ${shifts.join(', ')} кількість денних часів (${dayTimes.length}) не збігається з кількістю зупинок (${stopsCount})`);
    }

    if (nightTimes.length && nightTimes.length !== stopsCount) {
      throw new Error(`Для групи ${shifts.join(', ')} кількість нічних часів (${nightTimes.length}) не збігається з кількістю зупинок (${stopsCount})`);
    }

    const baseTimes = dayTimes.length ? dayTimes : nightTimes;
    const segments = buildSegmentsFromTimes(baseTimes);

    schedule.push({
      shifts,
      day_start: dayTimes[0] || '',
      night_start: nightTimes[0] || '',
      stop_times_day: dayTimes,
      stop_times_night: nightTimes,
      segments_min: segments
    });
  }

  return schedule;
}

function resetRouteEditor() {
  const shifts = document.querySelectorAll('input[name="route_shifts"]');
  shifts.forEach(cb => { cb.checked = false; });

  const groups = document.getElementById('scheduleGroups');
  if (groups) groups.innerHTML = '';

  addScheduleGroup();
  updateScheduleStopsHint();
}

function setRouteModalUiMode(mode) {
  const title = document.querySelector('#routeModal h2');
  const submitBtn = document.getElementById('routeSubmitBtn');
  const deleteBtn = document.getElementById('routeDeleteBtn');

  if (title) title.textContent = mode === 'edit' ? 'Редагувати маршрут' : 'Додати маршрут';
  if (submitBtn) submitBtn.textContent = mode === 'edit' ? 'Зберегти' : 'Додати';
  if (deleteBtn) deleteBtn.style.display = mode === 'edit' ? 'inline-block' : 'none';
}

function cloneStop(stop) {
  return {
    name: String(stop && stop.name || '').trim(),
    lat: Number(stop && stop.lat),
    lng: Number(stop && stop.lng)
  };
}

window.openRouteModalForEdit = function(route) {
  if (!route || typeof route !== 'object') return;

  const routeModal = document.getElementById('routeModal');
  const routeFormEl = document.getElementById('routeForm');
  if (!routeModal || !routeFormEl) return;

  window.routeModalState = {
    mode: 'edit',
    rowId: route._rowId || route.id || null
  };

  setRouteModalUiMode('edit');

  routeFormEl.route_code.value = String(route.route_code || '');
  routeFormEl.color.value = String(route.color || '#e41a1c');

  const selectedShifts = new Set(Array.isArray(route.shifts) ? route.shifts : []);
  document.querySelectorAll('input[name="route_shifts"]').forEach(cb => {
    cb.checked = selectedShifts.has(cb.value);
  });

  window.pickedStops = (Array.isArray(route.stops) ? route.stops : [])
    .map(cloneStop)
    .filter(s => s.name && !Number.isNaN(s.lat) && !Number.isNaN(s.lng));

  const groups = document.getElementById('scheduleGroups');
  if (groups) groups.innerHTML = '';

  const schedule = Array.isArray(route.schedule) ? route.schedule : [];
  if (schedule.length) {
    schedule.forEach(group => addScheduleGroup(group));
  } else {
    addScheduleGroup();
  }

  updatePickedStopsList();
  routeModal.style.display = 'flex';
};

const _addScheduleGroupBtn = document.getElementById('addScheduleGroupBtn');
if (_addScheduleGroupBtn) {
  _addScheduleGroupBtn.addEventListener('click', () => addScheduleGroup());
}

addScheduleGroup();
updateScheduleStopsHint();

// Кнопка "вибрати на мапі"
const _pickOnMapBtn = document.getElementById('pickOnMapBtn');
if (_pickOnMapBtn) _pickOnMapBtn.onclick = function () {
  window.pickMode = true;
  window.pickedStops = [];

  const _miniMapContainer = document.getElementById('miniMapContainer');
  if (_miniMapContainer) _miniMapContainer.style.display = 'block';

  initMiniMap();
};

// Завершити вибір
const _finishPickBtn = document.getElementById('finishPickBtn');
if (_finishPickBtn) _finishPickBtn.onclick = function () {
  window.pickMode = false;
  updatePickedStopsList();
  const _miniMapContainer2 = document.getElementById('miniMapContainer');
  if (_miniMapContainer2) _miniMapContainer2.style.display = 'none';
};

const _pickPersonOnMapBtn = document.getElementById('pickPersonOnMapBtn');
if (_pickPersonOnMapBtn) _pickPersonOnMapBtn.onclick = function () {
  const personContainer = document.getElementById('personMiniMapContainer');
  if (personContainer) personContainer.style.display = 'block';

  initPersonMiniMap();
  if (personMiniMap) personMiniMap.invalidateSize();
};

const _finishPersonPickBtn = document.getElementById('finishPersonPickBtn');
if (_finishPersonPickBtn) _finishPersonPickBtn.onclick = function () {
  const personContainer = document.getElementById('personMiniMapContainer');
  if (personContainer) personContainer.style.display = 'none';
};

// ===== UPDATE SPISOK =====
window.updatePickedStopsList = function () {
  let html = '';

  window.pickedStops.forEach((s, i) => {
    html += `<span style='margin:4px;padding:4px;background:#eee;display:inline-block'>
      ${s.name}
      <button onclick='removePicked(${i})'>×</button>
    </span>`;
  });

  const _pickedStopsList = document.getElementById('pickedStopsList');
  if (_pickedStopsList) _pickedStopsList.innerHTML = html;

  const _stopsInput = document.getElementById('stopsInput');
  if (_stopsInput) _stopsInput.value = window.pickedStops.map(s => s.name).join(', ');

  updateScheduleStopsHint();
};

window.removePicked = function (idx) {
  window.pickedStops.splice(idx, 1);
  updatePickedStopsList();
};

// ===== ДОДАТИ МАРШРУТ =====
const _routeForm = document.getElementById('routeForm');
if (_routeForm) _routeForm.onsubmit = async function (e) {
  e.preventDefault();

  const f = e.target;

  const stops = getDraftStopsWithRozivka();
  if (!stops.some(s => String(s.name || '').toLowerCase() === 'розівка')) {
    alert('Розівка не знайдена в settlements.json');
    return;
  }

  const routeShifts = Array.from(document.querySelectorAll('input[name="route_shifts"]:checked')).map(i => i.value);
  if (!routeShifts.length) {
    alert('Оберіть хоча б одну зміну для маршруту');
    return;
  }

  let schedule = [];
  try {
    schedule = collectScheduleFromEditor(stops.length);
  } catch (err) {
    alert(err.message || err);
    return;
  }

  const newRoute = {
    route_code: f.route_code.value,
    color: f.color.value,
    type: routeShifts.length === 1 && routeShifts[0] === 'Офіс' ? 'office' : 'shift',
    shifts: routeShifts,
    schedule,
    stops
  };

  const routePayload = sanitizeRouteForStorage(newRoute);
  if (!routePayload || !routePayload.route_code || !routePayload.stops.length) {
    alert('Не вдалося підготувати маршрут для збереження. Перевірте назву та зупинки.');
    return;
  }

  let data = null;
  let error = null;

  const routeTable = window.getTableName ? window.getTableName('routes') : 'routes';

  if (window.routeModalState && window.routeModalState.mode === 'edit' && window.routeModalState.rowId) {
    const result = await window.db
      .from(routeTable)
      .update({ data: routePayload })
      .eq('id', window.routeModalState.rowId);
    data = result.data;
    error = result.error;
  } else {
    const result = await window.db
      .from(routeTable)
      .insert([{ data: routePayload }]);
    data = result.data;
    error = result.error;
  }

  console.log('INSERT RESULT:', data, error);

  if (error) {
    alert('Помилка збереження маршруту: ' + (error.message || 'невідома помилка'));
    return;
  }

  f.reset();
  window.pickedStops = [];
  window.routeModalState = { mode: 'create', rowId: null };
  setRouteModalUiMode('create');
  resetRouteEditor();
  updatePickedStopsList();

  const _routeModal = document.getElementById('routeModal');
  if (_routeModal) _routeModal.style.display = 'none';

  if (typeof loadRoutes === 'function') {
    loadRoutes();
  }
};

// ===== ДОДАТИ ЛЮДИНУ =====
const _personForm = document.getElementById('personForm');
if (_personForm) _personForm.onsubmit = async function (e) {
  e.preventDefault();

  const f = e.target;

  const newPerson = {
    name: 'manual',
    city: f.settlement.value.trim(),
    shift: f.shift.value
  };

  console.log('SAVE PERSON:', newPerson);

  const peopleTable = window.getTableName ? window.getTableName('people') : 'people';
  const { data, error } = await window.db
    .from(peopleTable)
    .insert([newPerson]);

  console.log('INSERT PERSON:', data, error);

  if (!error) {
    loadAndDrawPeople();
  }

  f.reset();
  const _personModal = document.getElementById('personModal');
  if (_personModal) _personModal.style.display = 'none';
};

// ===== ВІДКРИТТЯ / ЗАКРИТТЯ МОДАЛОК =====
const _addRouteBtn = document.getElementById('addRouteBtn');
if (_addRouteBtn) _addRouteBtn.onclick = function() {
  window.routeModalState = { mode: 'create', rowId: null };
  setRouteModalUiMode('create');
  const _routeModal2 = document.getElementById('routeModal');
  if (_routeModal2) _routeModal2.style.display = 'flex';
  resetRouteEditor();
  updatePickedStopsList();
};

const _closeRouteModal = document.getElementById('closeRouteModal');
if (_closeRouteModal) _closeRouteModal.onclick = function() {
  window.routeModalState = { mode: 'create', rowId: null };
  setRouteModalUiMode('create');
  const _routeModal3 = document.getElementById('routeModal');
  if (_routeModal3) _routeModal3.style.display = 'none';
};

const _routeDeleteBtn = document.getElementById('routeDeleteBtn');
if (_routeDeleteBtn) _routeDeleteBtn.onclick = async function() {
  if (!window.routeModalState || window.routeModalState.mode !== 'edit' || !window.routeModalState.rowId) return;
  if (!confirm('Видалити маршрут?')) return;

  const routeTable = window.getTableName ? window.getTableName('routes') : 'routes';
  const { error } = await window.db
    .from(routeTable)
    .delete()
    .eq('id', window.routeModalState.rowId);

  if (error) {
    alert('Помилка видалення маршруту: ' + (error.message || 'невідома помилка'));
    return;
  }

  window.routeModalState = { mode: 'create', rowId: null };
  setRouteModalUiMode('create');

  const _routeModalDel = document.getElementById('routeModal');
  if (_routeModalDel) _routeModalDel.style.display = 'none';

  if (typeof loadRoutes === 'function') {
    loadRoutes();
  }
};

const _addPersonBtn = document.getElementById('addPersonBtn');
if (_addPersonBtn) _addPersonBtn.onclick = function() {
  const _personModal2 = document.getElementById('personModal');
  if (_personModal2) _personModal2.style.display = 'flex';
};

const _closePersonModal = document.getElementById('closePersonModal');
if (_closePersonModal) _closePersonModal.onclick = function() {
  const personContainer = document.getElementById('personMiniMapContainer');
  if (personContainer) personContainer.style.display = 'none';
  const _personModal3 = document.getElementById('personModal');
  if (_personModal3) _personModal3.style.display = 'none';
};

const _showListBtn = document.getElementById('showListBtn');
if (_showListBtn) _showListBtn.onclick = function() {
  renderRoutesList();
  const _listModal = document.getElementById('listModal');
  if (_listModal) _listModal.style.display = 'flex';
};

window.onclick = function(event) {
  const _routeModal4 = document.getElementById('routeModal');
  if (_routeModal4 && event.target === _routeModal4) {
    window.routeModalState = { mode: 'create', rowId: null };
    setRouteModalUiMode('create');
    _routeModal4.style.display = 'none';
  }
  const _personModal4 = document.getElementById('personModal');
  if (_personModal4 && event.target === _personModal4) {
    const personContainer = document.getElementById('personMiniMapContainer');
    if (personContainer) personContainer.style.display = 'none';
    _personModal4.style.display = 'none';
  }
};

const _closeListModal = document.getElementById('closeListModal');
if (_closeListModal) _closeListModal.onclick = function() {
  const _listModal2 = document.getElementById('listModal');
  if (_listModal2) _listModal2.style.display = 'none';
};

async function renderRoutesList() {
  const container = document.getElementById('routesList');

  const res = await fetch('data/people.json');
  const jsonPeople = await res.json();
  const peopleTable = window.getTableName ? window.getTableName('people') : 'people';
  const { data: dbPeople } = await window.db.from(peopleTable).select('*');
  const people = [...jsonPeople, ...(dbPeople || [])];

  let html = '<h3>Маршрути</h3>';

  window.JABIL_ROUTES.forEach((route, idx) => {
    html += '<div style="border:1px solid #ccc;margin:10px;padding:10px">';
    html += `<b>${route.route_code}</b>`;
    html += ` <button onclick="deleteRoute(${idx})">🗑</button>`;
    html += ` <label style="margin-left:8px">Тип: <select onchange="updateRouteType(${idx}, this.value)">`;
    html += ` <option value="shift" ${route.type !== 'office' ? 'selected' : ''}>Позмінний</option>`;
    html += ` <option value="office" ${route.type === 'office' ? 'selected' : ''}>Офісний</option>`;
    html += '</select></label>';
    html += '<ul>';
    route.stops.forEach(stop => {
      html += `<li>${stop.name}</li>`;
    });
    html += '</ul></div>';
  });

  html += `<h3>Люди</h3>
<input
  type="text"
  id="peopleSearch"
  placeholder="Пошук по імені, місту або зміні..."
  style="width:100%;padding:6px;margin-bottom:10px"
  oninput="debouncedFilter()"
/>
<div id="peopleList">`;

  people.forEach(p => {
    html += `<div class="person-item" style="margin:5px 0">${p.name} <span style="color:#d67b04;">${p.city}</span> (${p.shift}) <button onclick="deletePerson('${p.id}')">🗑</button></div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

window.deleteRoute = async function(idx) {
  if (!confirm('Видалити маршрут?')) return;

  const route = window.JABIL_ROUTES[idx];
  window.JABIL_ROUTES.splice(idx, 1);

  if (window.JABIL_UPDATE) {
    window.JABIL_UPDATE();
  }

  console.log('DELETE (локально):', route);
  renderRoutesList();
};

window.deletePerson = async function(id) {
  if (!confirm('Видалити людину?')) return;

  const peopleTable = window.getTableName ? window.getTableName('people') : 'people';
  await window.db
    .from(peopleTable)
    .delete()
    .eq('id', id);

  renderRoutesList();
  loadAndDrawPeople();
};

window.filterPeople = function() {
  const input = document.getElementById('peopleSearch').value.toLowerCase();
  const items = document.querySelectorAll('.person-item');

  items.forEach(el => {
    const text = el.innerText.toLowerCase();
    el.style.display = text.includes(input) ? '' : 'none';
  });
};

let searchTimeout;

window.debouncedFilter = function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filterPeople();
  }, 350);
};

window.updateRouteType = async function(idx, newType) {
  const route = window.JABIL_ROUTES[idx];
  if (!route) return;
  route.type = newType;

  if (route._rowId) {
    const sanitized = sanitizeRouteForStorage(route);
    const routeTable = window.getTableName ? window.getTableName('routes') : 'routes';
    const { data, error } = await window.db
      .from(routeTable)
      .update({ data: sanitized })
      .eq('id', route._rowId);

    if (error) console.error('Failed to update route type in DB:', error);
    else console.log('Route updated in DB:', data);
  }

  if (window.JABIL_UPDATE) window.JABIL_UPDATE();
  renderRoutesList();
};
