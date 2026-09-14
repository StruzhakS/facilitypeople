function ensureRouteFilterBanner() {
  let banner = document.getElementById('routeFilterBanner');
  if (banner) return banner;

  banner = document.createElement('div');
  banner.id = 'routeFilterBanner';
  banner.style.position = 'fixed';
  banner.style.top = '190px';
  banner.style.left = '20px';
  banner.style.zIndex = '10005';
  banner.style.width = '300px';
  banner.style.maxWidth = '300px';
  banner.style.maxHeight = '70vh';
  banner.style.overflow = 'auto';
  banner.style.padding = '12px 12px 10px';
  banner.style.background = '#ffffffee';
  banner.style.border = '1px solid rgba(0,0,0,0.12)';
  banner.style.borderRadius = '10px';
  banner.style.boxShadow = '0 4px 14px rgba(0,0,0,0.16)';
  banner.style.fontSize = '13px';
  banner.style.backdropFilter = 'blur(4px)';
  banner.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;"><label style="display:flex;align-items:center;gap:6px;font-weight:700;cursor:pointer;min-width:0;"><input type="checkbox" id="routeFilterAll" checked /><span>Виділити всі</span></label><button id="toggleRouteBanner" type="button" style="border:none;background:#f1f1f1;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">хов.</button></div><div id="routeFilterBannerBody"><div id="routeFilterList"></div></div>`;
  document.body.appendChild(banner);
  return banner;
}

function ensureShiftBannerControls() {
  const button = document.getElementById('toggleShiftBanner');
  const body = document.getElementById('shiftBannerBody');
  if (!button || !body || button.dataset.bound === '1') return;

  button.dataset.bound = '1';
  button.addEventListener('click', () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    button.textContent = hidden ? 'сховати' : 'показати';
  });
}

function ensureRouteBannerControls() {
  const button = document.getElementById('toggleRouteBanner');
  const body = document.getElementById('routeFilterBannerBody');
  const selectAll = document.getElementById('routeFilterAll');

  if (button && body && button.dataset.bound !== '1') {
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      button.textContent = hidden ? 'сховати' : 'показати';
    });
  }

  if (selectAll && selectAll.dataset.bound !== '1') {
    selectAll.dataset.bound = '1';
    selectAll.addEventListener('change', () => {
      const tiles = document.querySelectorAll('#routeFilterList [data-route-id]');
      tiles.forEach(tile => {
        tile.dataset.checked = selectAll.checked ? '1' : '0';
        const route = window.JABIL_ROUTES.find(item => String(item._rowId) === String(tile.dataset.routeId));
        if (route) setRouteVisible(route, selectAll.checked);
        updateRouteTileState(tile, selectAll.checked);
      });
    });
  }
}

function refreshRouteFilterAllState() {
  const selectAll = document.getElementById('routeFilterAll');
  const tiles = document.querySelectorAll('#routeFilterList [data-route-id]');
  if (!selectAll || !tiles.length) return;
  selectAll.checked = Array.from(tiles).every(tile => tile.dataset.checked === '1');
}

function renderRouteFilterBanner() {
  if (!Array.isArray(window.JABIL_ROUTES) || !window.JABIL_ROUTES.length) return;
  const banner = ensureRouteFilterBanner();
  ensureRouteBannerControls();
  const list = banner.querySelector('#routeFilterList');
  if (!list) return;

  const sortedRoutes = [...window.JABIL_ROUTES].sort(compareRouteCodes);

  const applyRouteCardState = (row, tile, text) => {
    const active = String(tile.dataset.checked) === '1';
    row.style.background = active ? 'rgb(102 137 235)' : '#fff';
    row.style.borderColor = active ? 'rgb(102 137 235)' : 'rgba(0,0,0,0.08)';
    row.style.boxShadow = active ? '0 1px 4px rgba(29,78,216,0.22)' : 'none';
    text.style.color = active ? '#fff' : '#111827';
    text.querySelectorAll('div').forEach(div => {
      div.style.color = active ? '#fff' : (div === text.firstElementChild ? '#111827' : '#666');
    });
    tile.style.color = active ? '#fff' : '#111827';
  };

  window.updateRouteTileState = (tile, active) => {
    if (!tile) return;
    const row = tile.closest('label');
    const text = tile.querySelector('.route-tile-text');
    if (row && text) {
      applyRouteCardState(row, tile, text);
    }
  };

  list.innerHTML = '';
  list.style.display = 'flex';
  list.style.flexWrap = 'wrap';
  list.style.alignItems = 'flex-start';
  list.style.gap = '4px';

  sortedRoutes.forEach((route) => {
    const row = document.createElement('label');
    row.style.display = 'inline-flex';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.style.gap = '0';
    row.style.padding = '2px';
    row.style.border = '1px solid rgba(0,0,0,0.08)';
    row.style.borderRadius = '8px';
    row.style.background = '#fff';
    row.style.cursor = 'pointer';
    row.style.minWidth = '0';
    row.style.width = 'fit-content';
    row.style.flex = '0 0 auto';
    row.style.transition = 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease';

    const savedVisibility = window.routeVisibilityState && Object.prototype.hasOwnProperty.call(window.routeVisibilityState, String(route._rowId))
      ? window.routeVisibilityState[String(route._rowId)]
      : true;
    row.dataset.routeId = String(route._rowId);
    row.dataset.checked = savedVisibility ? '1' : '0';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const text = document.createElement('div');
    text.className = 'route-tile-text';
    text.style.lineHeight = '1.25';
    text.style.fontSize = '15px';
    text.style.minWidth = '0';
    text.style.overflow = 'hidden';
    text.style.flex = '1 1 auto';
    text.style.padding = '2px';
    text.style.textAlign = 'center';
    text.style.borderRadius = '6px';
    text.style.width = 'max-content';
    text.style.whiteSpace = 'nowrap';
    text.innerHTML = `<div style="font-weight:600;">${getRouteDisplayCode(route)}</div><div style="font-size:15px;opacity:0.9;">${getRouteShiftsLabel(route)}</div>`;

    const toggleRoute = () => {
      const active = row.dataset.checked !== '1';
      row.dataset.checked = active ? '1' : '0';
      setRouteVisible(route, active);
      refreshRouteFilterAllState();
      if (active) {
        focusOnRoute(route);
      }
      applyRouteCardState(row, row, text);
    };

    row.addEventListener('click', (event) => {
      event.preventDefault();
      toggleRoute();
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleRoute();
      }
    });

    row.appendChild(text);
    applyRouteCardState(row, row, text);
    list.appendChild(row);
  });

  refreshRouteFilterAllState();
}

function syncRouteFilterBanner() {
  const banner = document.getElementById('routeFilterBanner');
  if (!banner || !Array.isArray(window.JABIL_ROUTES) || !window.JABIL_ROUTES.length) return;
  const tiles = banner.querySelectorAll('[data-route-id]');
  const byId = new Map(window.JABIL_ROUTES.map(route => [String(route._rowId), route]));
  tiles.forEach(tile => {
    const route = byId.get(String(tile.dataset.routeId));
    if (!route) return;
    const active = String(tile.dataset.checked) === '1';
    setRouteVisible(route, active);
  });
}

// wrapper, який використовує кеш за ключем stops
async function fetchRouteWithCache(route) {
  const key = route.stops.map(s => `${s.lat},${s.lng}`).join('|');
  if (window.routeGeoCache[key]) return window.routeGeoCache[key];
  const geo = await fetchRoute(route.stops.map(s => [s.lng, s.lat]));
  if (geo) window.routeGeoCache[key] = geo;
  return geo;
}

async function loadLocalRoutesFallback() {
  const sources = ['data/routes.json', 'data/people_routes.json'];
  for (const src of sources) {
    try {
      const response = await fetch(src);
      if (!response.ok) continue;
      const json = await response.json();
      if (Array.isArray(json) && json.length) {
        return json;
      }
    } catch (err) {
      console.warn('Не вдалося завантажити локальний файл маршрутів:', src, err);
    }
  }
  return [];
}

function createRoutePopupHtml(route, showLoadButton = false) {
  let html = `<b>${getRouteDisplayCode(route)} (${getRouteShiftsLabel(route)})</b><br>Загалом: ${route.people || 0} працівників`;
  if (showLoadButton) {
    html += `<div style='margin-top:8px;'><button class='load-geo' data-route='${route._rowId}' style='padding:6px 10px;border:none;background:#1976d2;color:#fff;border-radius:4px;cursor:pointer;'>Показати точний маршрут</button></div>`;
  }
  return html;
}

// ===== ПЕРФОРМАНС: централізоване отримання людей (JSON + DB) =====
window._peopleCache = { ts: 0, data: null };
async function fetchAllPeople(force = false) {
  // кешувати на невеликий час (наприклад 30s) щоб уникнути дублювання при рендері
  const now = Date.now();
  if (!force && window._peopleCache.data && (now - window._peopleCache.ts) < 30000) {
    return window._peopleCache.data;
  }

  // люди з JSON
  const res = await fetch('data/people.json');
  const jsonPeople = await res.json();

  // люди з бази
  const peopleTable = window.getTableName ? window.getTableName('people') : 'people';
  const { data: dbPeople, error } = await window.db
    .from(peopleTable)
    .select('*');

  if (error) console.error('Error loading people from DB:', error);

  const people = [...jsonPeople, ...(dbPeople || [])];
  window._peopleCache = { ts: now, data: people };
  return people;
}

// ===== РОТАЦІЯ ЗМІН (періоди: 06:00 та 18:30) =====
window.shiftRotation = ['A','B','A','B','A','B','C','D','C','D','C','D','B','A','B','A','B','A','D','C','D','C','D','C'];
// Початкова точка відліку — ранок 13 червня 2026 року о 06:00
window.rotationStartDate = '2026-06-13';

function parseRotationStart() {
  const parts = window.rotationStartDate.split('-').map(Number);
  return new Date(parts[0], parts[1]-1, parts[2], 6, 0, 0, 0);
}

function getRotationIndexForDateTime(now) {
  const start = parseRotationStart();
  const startDayUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysDiff = Math.floor((nowDayUtc - startDayUtc) / 86400000);

  // межі сьогодні
  const today06 = new Date(now);
  today06.setHours(6,0,0,0);
  const today1830 = new Date(now);
  today1830.setHours(18,30,0,0);

  let periodIndex;
  if (now >= today06 && now < today1830) {
    // перший період сьогодні
    periodIndex = daysDiff * 2;
  } else if (now >= today1830) {
    // другий період сьогодні
    periodIndex = daysDiff * 2 + 1;
  } else {
    // до 06:00 — ніч попереднього дня
    periodIndex = (daysDiff - 1) * 2 + 1;
  }

  const len = window.shiftRotation.length;
  return ((periodIndex % len) + len) % len;
}

function getCurrentAndNextShift(now = new Date()) {
  const idx = getRotationIndexForDateTime(now);
  const current = window.shiftRotation[idx];
  const next = window.shiftRotation[(idx + 1) % window.shiftRotation.length];
  return { current, next, index: idx };
}

function getCurrentShiftNow(now = new Date()) {
  const { current, next } = getCurrentAndNextShift(now);
  // визначаємо період (day/night)
  const today06 = new Date(now);
  today06.setHours(6,0,0,0);
  const today1830 = new Date(now);
  today1830.setHours(18,30,0,0);
  const period = (now >= today06 && now < today1830) ? 'day' : 'night';
  return { current, next, period };
}

function renderShiftCalendar() {
  const cal = document.getElementById('shiftCalendar');
  if (!cal) return;
  cal.innerHTML = '';
  cal.style.justifyContent = 'center';

  const today = new Date();
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);

    const dayDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0, 0);
    const nightDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 30, 0, 0);
    const dayShift = window.shiftRotation[getRotationIndexForDateTime(dayDt)];
    const nightShift = window.shiftRotation[getRotationIndexForDateTime(nightDt)];

    const isToday = offset === 0;
    const box = document.createElement('div');
    box.style.minWidth = '64px';
    box.style.minHeight = '92px';
    box.style.borderRadius = '12px';
    box.style.border = '1px solid rgba(0,0,0,0.14)';
    box.style.background = '#ffffff';
    box.style.fontSize = '12px';
    box.style.textAlign = 'center';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'space-between';
    box.style.boxShadow = isToday ? '0 3px 14px rgba(0,0,0,0.15)' : 'none';
    box.style.margin = '0 2px';
    box.style.overflow = 'hidden';
    if (isToday) {
      box.style.transform = 'scale(1.05)';
      box.style.position = 'relative';
    }

    const dateLine = document.createElement('div');
    dateLine.style.fontWeight = '700';
    dateLine.style.margin = '8px 0 6px';
    dateLine.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

    const split = document.createElement('div');
    split.style.display = 'flex';
    split.style.flexDirection = 'column';
    split.style.width = '100%';
    split.style.height = '100%';

    const dayBlock = document.createElement('div');
    dayBlock.style.flex = '1';
    dayBlock.style.width = '100%';
    dayBlock.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    dayBlock.style.display = 'flex';
    dayBlock.style.flexDirection = 'column';
    dayBlock.style.justifyContent = 'center';
    dayBlock.style.alignItems = 'center';
    // dayBlock.style.padding = '6px 4px';
    dayBlock.style.background = '#fff8dc';
    dayBlock.style.color = '#5a4300';
    dayBlock.style.fontWeight = '600';
    dayBlock.innerHTML = `<div style="display:flex;align-items:center;gap:4px;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="5" fill="#FFC107" />
          <g stroke="#FFB300" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="1" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="23" y2="12" />
            <line x1="4.2" y1="4.2" x2="6.8" y2="6.8" />
            <line x1="17.2" y1="17.2" x2="19.8" y2="19.8" />
            <line x1="4.2" y1="19.8" x2="6.8" y2="17.2" />
            <line x1="17.2" y1="6.8" x2="19.8" y2="4.2" />
          </g>
        </svg>
        <span>${dayShift}</span>
      </div>`;

    const nightBlock = document.createElement('div');
    nightBlock.style.flex = '1';
    nightBlock.style.width = '100%';
    nightBlock.style.display = 'flex';
    nightBlock.style.flexDirection = 'column';
    nightBlock.style.justifyContent = 'center';
    nightBlock.style.alignItems = 'center';
    // nightBlock.style.padding = '6px 4px';
    nightBlock.style.background = '#eef6ff';
    nightBlock.style.color = '#1f3c72';
    nightBlock.style.fontWeight = '600';
    nightBlock.innerHTML = `<div style="display:flex;align-items:center;gap:4px;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 12.5C17 16.08 14.09 19 10.5 19C8.34 19 6.44 17.96 5.25 16.3C6.86 16.56 8.54 16.34 9.95 15.7C11.4 15.03 12.56 13.87 13.22 12.42C13.87 10.97 14.08 9.29 13.82 7.68C15.45 8.88 16.5 10.97 16.5 13.25C16.5 13.35 16.49 13.45 16.49 13.55C16.45 13.6 16.4 13.64 16.36 13.69C16.04 14.1 15.64 14.44 15.18 14.7C15.67 14.62 16.13 14.43 16.54 14.13C17.76 13.29 18.5 11.83 18.5 10.25C18.5 9.16 18.17 8.14 17.59 7.28C17.39 8.09 17 8.83 16.46 9.45C16.2 9.77 16.11 10.22 16.27 10.61C16.55 11.25 16.7 11.92 16.7 12.5Z" fill="#3F51B5" />
          <path d="M9 3C9.55228 3 10 3.44772 10 4V5C10 5.55228 9.55228 6 9 6C8.44772 6 8 5.55228 8 5V4C8 3.44772 8.44772 3 9 3Z" fill="#3F51B5" opacity="0.5" />
        </svg>
        <span>${nightShift}</span>
      </div>`;

    if (isToday) {
      const now = new Date();
      const nowPeriod = (now >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0) && now < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30, 0)) ? 'day' : 'night';
      if (nowPeriod === 'day') {
        dayBlock.style.background = '#ffeaa7';
        dayBlock.style.boxShadow = 'inset 0 0 0 2px rgba(255,170,0,0.35)';
        dayBlock.classList.add('active-shift');
      } else {
        nightBlock.style.background = '#d6e7ff';
        nightBlock.style.boxShadow = 'inset 0 0 0 2px rgba(60,109,255,0.35)';
        nightBlock.classList.add('active-shift');
      }
    }

    split.appendChild(dayBlock);
    split.appendChild(nightBlock);

    box.appendChild(dateLine);
    box.appendChild(split);
    cal.appendChild(box);
  }
}

function updateShiftBanner() {
  const txt = document.getElementById('shiftBannerText');
  if (!txt) return;
  ensureShiftBannerControls();
  const now = new Date();
  const info = getCurrentShiftNow(now);
  const hh = now.getHours();
  const mm = now.getMinutes().toString().padStart(2,'0');
  txt.textContent = `Працює: зміна ${info.current}`;
  try {
    renderShiftCalendar();
  } catch (e) {
    console.error('renderShiftCalendar error', e);
    const cal = document.getElementById('shiftCalendar');
    if (cal) cal.textContent = '';
  }
}

setTimeout(() => updateShiftBanner(), 100);
setInterval(updateShiftBanner, 60*1000);




// Завантаження маршрутів

// Глобальна змінна для маршрутів
window.JABIL_ROUTES = null;
window.JABIL_UPDATE = function () {
  if (typeof updateRoutesOnMap === 'function') {
    return updateRoutesOnMap();
  }
};

// 📊 Підрахунок людей на основі міста і змін
async function calculatePeopleByCity(providedPeople) {
  const people = providedPeople || await fetchAllPeople();

  // 4. групування по міста і змін
  const cityShiftMap = {};

  people.forEach(p => {
    const city = (p.city || '').trim();
    const shift = normalizeShiftValue(p.shift);

    if (!city) return;
    if (!shift) return;

    if (!cityShiftMap[city]) {
      cityShiftMap[city] = { A: 0, B: 0, C: 0, D: 0, Офіс: 0 };
    }

    if (cityShiftMap[city][shift] !== undefined) {
      cityShiftMap[city][shift]++;
    }
  });

  return cityShiftMap;
}

// Завантаження маршрутів з JSON
