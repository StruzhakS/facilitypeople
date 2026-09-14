// Використання OpenRouteService для побудови маршрутів по дорогах
// API-ключ: eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijk4MDk2MjhiYjg2NDQ0ZjJhNGYyOWFjNTU0NWI5Nzg1IiwiaCI6Im11cm11cjY0In0=
// Для реального використання — замінити fetchRoute на асинхронний запит до OpenRouteService
async function fetchRoute(coords) {
  const apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijk4MDk2MjhiYjg2NDQ0ZjJhNGYyOWFjNTU0NWI5Nzg1IiwiaCI6Im11cm11cjY0In0=';
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
  const body = {
    coordinates: coords
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data;
}

// Додає обробники та popup для шару маршруту
function attachRoutePopupHandlers(layer, route) {
  const allowedShifts = route._allowedShifts || [];
  const allowedStr = allowedShifts.join(', ');
  
  let popupHtml = `<b>${getRouteDisplayCode(route)} (${getRouteShiftsLabel(route)})</b><br>Загалом: ${route.people} працівників<br><small style='color:#666;'>Рахується по змінах: ${allowedStr}</small>`;
  popupHtml += createRouteCombinedTableHtml(route);

  if (layer.eachLayer) {
    layer.eachLayer(function (l) {
      l.on('click', function (e) {
        L.popup({ maxWidth: 960, minWidth: 360, className: 'route-popup-wide' })
          .setLatLng(e.latlng)
          .setContent(popupHtml)
          .openOn(map);
      });
    });
  } else if (layer.on) {
    layer.on('click', function(e) {
      L.popup({ maxWidth: 960, minWidth: 360, className: 'route-popup-wide' })
        .setLatLng(e.latlng)
        .setContent(popupHtml)
        .openOn(map);
    });
  }
}

function createRouteCombinedTableHtml(route) {
  const stops = Array.isArray(route.stops) ? route.stops : [];
  const scheduleItems = Array.isArray(route.schedule) ? route.schedule : [];

  const prepared = scheduleItems.map(item => {
    const shiftLabel = Array.isArray(item.shifts) && item.shifts.length ? item.shifts.join(', ') : 'усі зміни';
    return {
      shiftLabel,
      dayStops: buildStopTimesFromScheduleItem(route, item, 'day'),
      nightStops: buildStopTimesFromScheduleItem(route, item, 'night')
    };
  });

  let sumA = 0;
  let sumB = 0;
  let sumC = 0;
  let sumD = 0;
  let sumOffice = 0;

  let html = `<table style='width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;border:1px solid rgba(0,0,0,0.08);'>`;
  html += `<tr style='background:#f3f4f6;'><th style='text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>Зупинка</th><th style='padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>A</th><th style='padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>B</th><th style='padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>C</th><th style='padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>D</th><th style='padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>Офіс</th><th style='text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>День</th><th style='text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);'>Ніч</th></tr>`;

  stops.forEach((stop, stopIndex) => {
    const a = Number(stop.people && stop.people.A || 0);
    const b = Number(stop.people && stop.people.B || 0);
    const c = Number(stop.people && stop.people.C || 0);
    const d = Number(stop.people && stop.people.D || 0);
    const office = Number(stop.people && stop.people.Офіс || 0);

    sumA += a;
    sumB += b;
    sumC += c;
    sumD += d;
    sumOffice += office;

    const dayEntries = [];
    const nightEntries = [];

    prepared.forEach(item => {
      const dayPoint = item.dayStops[stopIndex];
      const nightPoint = item.nightStops[stopIndex];
      const isOfficeOnlyLabel = item.shiftLabel.trim().toLowerCase() === 'офіс';

      if (dayPoint && dayPoint.time) {
        dayEntries.push({
          label: item.shiftLabel,
          isOfficeOnlyLabel,
          time: String(dayPoint.time)
        });
      }
      if (nightPoint && nightPoint.time) {
        nightEntries.push({
          label: item.shiftLabel,
          isOfficeOnlyLabel,
          time: String(nightPoint.time)
        });
      }
    });

    const formatTimeCell = (entries) => {
      if (!entries.length) return `<span style='color:#999;'>-</span>`;

      const uniqueTimes = [...new Set(entries.map(entry => entry.time))];
      if (uniqueTimes.length === 1) {
        return `<b>${escapeHtml(uniqueTimes[0])}</b>`;
      }

      return entries.map(entry => {
        if (entry.isOfficeOnlyLabel) {
          return `<b>${escapeHtml(entry.time)}</b>`;
        }
        return `${escapeHtml(entry.label)}: <b>${escapeHtml(entry.time)}</b>`;
      }).join('<br>');
    };

    const dayCell = formatTimeCell(dayEntries);
    const nightCell = formatTimeCell(nightEntries);

    html += `<tr><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);font-weight:600;'>${escapeHtml(stop.name)}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;'>${a}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;'>${b}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;'>${c}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;'>${d}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;'>${office}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);'>${dayCell}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);'>${nightCell}</td></tr>`;
  });

  html += `<tr style='font-weight:700;background:#f9fafb;'><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);'>Всього</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;'>${sumA}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;'>${sumB}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;'>${sumC}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;'>${sumD}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;'>${sumOffice}</td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);'></td><td style='padding:6px 8px;border-top:1px solid rgba(0,0,0,0.08);'></td></tr>`;
  html += `</table>`;

  if (prepared.length) {
    const legend = prepared
      .map(item => escapeHtml(item.shiftLabel))
      .join(' | ');
    html += `<div style='margin-top:6px;font-size:11px;color:#666;'>Групи змін у графіку: ${legend}</div>`;
  }

  return `<div style='max-width:min(92vw,900px);'><div style='overflow:auto;max-height:52vh;'>${html}</div></div>`;
}

// ===== ПЕРФОРМАНС: кеш геометрій маршрутів =====
window.routeGeoCache = window.routeGeoCache || {};

async function ensureSettlementsLoaded() {
  if (window.settlementsList && Array.isArray(window.settlementsList) && window.settlementsList.length) {
    return window.settlementsList;
  }

  try {
    const response = await fetch('data/settlements.json');
    if (!response.ok) {
      throw new Error('Failed to load settlements.json');
    }
    const list = await response.json();
    window.settlementsList = list;
    return list;
  } catch (err) {
    console.error('Error loading settlements data:', err);
    return window.settlementsList || [];
  }
}

function findSettlementByName(name) {
  if (!window.settlementsList || !Array.isArray(window.settlementsList)) return null;
  const normalizedName = normalize(name);
  if (!normalizedName) return null;

  let found = window.settlementsList.find(s => normalize(s.name) === normalizedName);
  if (found) return found;

  found = window.settlementsList.find(s => normalize(s.name).includes(normalizedName));
  if (found) return found;

  found = window.settlementsList.find(s => normalizedName.includes(normalize(s.name)));
  return found || null;
}

function normalizeShiftValue(shift) {
  const raw = String(shift || '').trim().toLowerCase();
  if (!raw) return null;

  if (raw === 'a') return 'A';
  if (raw === 'b') return 'B';
  if (raw === 'c') return 'C';
  if (raw === 'd') return 'D';
  if (raw === 'офіс' || raw === 'офис' || raw === 'office') return 'Офіс';
  return null;
}

function parseRouteShifts(shifts) {
  let values = [];
  if (Array.isArray(shifts)) {
    values = shifts;
  } else if (typeof shifts === 'string') {
    const raw = shifts.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        values = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        values = raw.split(',');
      }
    } else {
      values = raw.split(',');
    }
  }

  const normalized = values
    .map(normalizeShiftValue)
    .filter(Boolean);

  return [...new Set(normalized)];
}

function getRouteShiftsLabel(route) {
  const shifts = Array.isArray(route._allowedShifts) ? route._allowedShifts : parseRouteShifts(route.shifts);
  return shifts.length ? shifts.join(', ') : 'без змін';
}

function getRouteDisplayCode(route) {
  const code = String(route && route.route_code ? route.route_code : '').trim();
  if (!code) return 'Маршрут';
  return code.replace(/^маршрут\s*/i, '').trim() || code;
}

function compareRouteCodes(routeA, routeB) {
  const codeA = getRouteDisplayCode(routeA);
  const codeB = getRouteDisplayCode(routeB);
  return codeA.localeCompare(codeB, 'uk', {
    numeric: true,
    sensitivity: 'base'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addMinutesToTime(startTime, minutesToAdd) {
  const raw = String(startTime || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return '';

  const [hours, minutes] = raw.split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes + Number(minutesToAdd || 0);
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const nextMinutes = (normalized % 60).toString().padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

function buildStopTimesFromScheduleItem(route, scheduleItem, period) {
  const startTime = period === 'night' ? scheduleItem.night_start : scheduleItem.day_start;

  const stops = Array.isArray(route.stops) ? route.stops : [];
  const directTimes = period === 'night' ? scheduleItem.stop_times_night : scheduleItem.stop_times_day;

  if (Array.isArray(directTimes) && directTimes.length === stops.length) {
    return stops.map((stop, index) => ({
      name: stop.name,
      time: String(directTimes[index] || '').trim()
    }));
  }

  if (!startTime) return [];

  const offsets = Array.isArray(scheduleItem.offsets_min) ? scheduleItem.offsets_min : null;
  const segments = Array.isArray(scheduleItem.segments_min) ? scheduleItem.segments_min : null;

  if (offsets && offsets.length === stops.length) {
    return stops.map((stop, index) => ({
      name: stop.name,
      time: addMinutesToTime(startTime, offsets[index] || 0)
    }));
  }

  if (segments && segments.length >= Math.max(0, stops.length - 1)) {
    const neededSegments = segments.slice(0, Math.max(0, stops.length - 1));
    let elapsed = 0;
    return stops.map((stop, index) => {
      if (index > 0) {
        elapsed += Number(neededSegments[index - 1] || 0);
      }
      return {
        name: stop.name,
        time: addMinutesToTime(startTime, elapsed)
      };
    });
  }

  return [];
}

function createScheduleTabContent(route, period) {
  const scheduleItems = Array.isArray(route.schedule) ? route.schedule : [];
  const matchingItems = scheduleItems.filter(item => period === 'night' ? item.night_start : item.day_start);

  if (!matchingItems.length) {
    return `<div style="padding:8px 2px;color:#666;">Графік для ${period === 'day' ? 'дня' : 'ночі'} не заповнений</div>`;
  }

  return matchingItems.map(item => {
    const stopTimes = buildStopTimesFromScheduleItem(route, item, period);
    const shiftLabel = Array.isArray(item.shifts) && item.shifts.length ? item.shifts.join(', ') : 'усі зміни';
    const startTime = period === 'night' ? item.night_start : item.day_start;

    let html = `<div style="margin-top:8px;padding:8px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;background:#fafafa;">`;
    html += `<div style="font-weight:700;margin-bottom:4px;">Зміни: ${escapeHtml(shiftLabel)}</div>`;
    html += `<div style="font-size:12px;color:#666;margin-bottom:6px;">Старт: ${escapeHtml(startTime || '-')}</div>`;

    if (!stopTimes.length) {
      html += `<div style="font-size:12px;color:#666;">Немає коректних даних зупинок або інтервалів</div>`;
    } else {
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
      stopTimes.forEach(stopTime => {
        html += `<tr><td style="padding:3px 4px;border-top:1px solid rgba(0,0,0,0.06);">${escapeHtml(stopTime.name)}</td><td style="padding:3px 4px;border-top:1px solid rgba(0,0,0,0.06);text-align:right;font-weight:600;">${escapeHtml(stopTime.time)}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `</div>`;
    return html;
  }).join('');
}

function createScheduleTabsHtml(route) {
  const scheduleItems = Array.isArray(route.schedule) ? route.schedule : [];
  if (!scheduleItems.length) {
    return `<div style="margin-top:10px;padding:8px 2px;color:#666;">Графік не заповнений</div>`;
  }

  const prepared = scheduleItems.map(item => {
    const shiftLabel = Array.isArray(item.shifts) && item.shifts.length ? item.shifts.join(', ') : 'усі зміни';
    return {
      shiftLabel,
      dayStart: String(item.day_start || '').trim(),
      nightStart: String(item.night_start || '').trim(),
      dayStops: buildStopTimesFromScheduleItem(route, item, 'day'),
      nightStops: buildStopTimesFromScheduleItem(route, item, 'night')
    };
  });

  const hasAnyDay = prepared.some(item => item.dayStops.length);
  const hasAnyNight = prepared.some(item => item.nightStops.length);

  if (!hasAnyDay && !hasAnyNight) {
    return `<div style="margin-top:10px;padding:8px 2px;color:#666;">Немає коректних даних графіка (перевірте day_start/night_start та intervals)</div>`;
  }

  let html = `<div style="margin-top:10px;">`;
  html += `<div style="font-size:12px;color:#555;margin-bottom:6px;">Графік по зупинках (усі зміни в одній таблиці)</div>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;overflow:hidden;">`;
  html += `<tr style="background:#f3f4f6;"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);">Зупинка</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);">День</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.08);">Ніч</th></tr>`;

  const stops = Array.isArray(route.stops) ? route.stops : [];
  stops.forEach((stop, stopIndex) => {
    const dayParts = [];
    const nightParts = [];

    prepared.forEach(item => {
      const dayPoint = item.dayStops[stopIndex];
      const nightPoint = item.nightStops[stopIndex];

      if (dayPoint && dayPoint.time) {
        dayParts.push(`${escapeHtml(item.shiftLabel)}: <b>${escapeHtml(dayPoint.time)}</b>`);
      }

      if (nightPoint && nightPoint.time) {
        nightParts.push(`${escapeHtml(item.shiftLabel)}: <b>${escapeHtml(nightPoint.time)}</b>`);
      }
    });

    const dayCell = dayParts.length ? dayParts.join('<br>') : `<span style="color:#999;">-</span>`;
    const nightCell = nightParts.length ? nightParts.join('<br>') : `<span style="color:#999;">-</span>`;

    html += `<tr><td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);font-weight:600;">${escapeHtml(stop.name)}</td><td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);">${dayCell}</td><td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,0.06);">${nightCell}</td></tr>`;
  });

  html += `</table>`;

  const legendParts = prepared.map(item => {
    const dayStart = item.dayStart || '-';
    const nightStart = item.nightStart || '-';
    return `<div><b>${escapeHtml(item.shiftLabel)}</b>: день ${escapeHtml(dayStart)}, ніч ${escapeHtml(nightStart)}</div>`;
  });
  html += `<div style="margin-top:8px;font-size:11px;color:#666;">${legendParts.join('')}</div>`;
  html += `</div>`;
  return html;
}

function focusOnRoute(route) {
  const bounds = L.latLngBounds();
  let hasPoints = false;

  if (route._routeLine) {
    try {
      const b = route._routeLine.getBounds && route._routeLine.getBounds();
      if (b && b.isValid()) { bounds.extend(b); hasPoints = true; }
    } catch (e) {}
  }

  if (Array.isArray(route._stopMarkers)) {
    route._stopMarkers.forEach(marker => {
      try {
        bounds.extend(marker.getLatLng());
        hasPoints = true;
      } catch (e) {}
    });
  }

  if (hasPoints && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }
}

function setRouteVisible(route, visible) {
  window.routeVisibilityState = window.routeVisibilityState || {};
  window.routeVisibilityState[String(route._rowId)] = !!visible;

  const layers = [];
  if (route._routeLine) layers.push(route._routeLine);
  if (Array.isArray(route._stopMarkers)) layers.push(...route._stopMarkers);

  for (const layer of layers) {
    const isOnMap = map.hasLayer(layer);
    if (visible && !isOnMap) {
      layer.addTo(map);
    } else if (!visible && isOnMap) {
      map.removeLayer(layer);
    }
  }
}

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
window.JABIL_UPDATE = updateRoutesOnMap;

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
async function loadRoutes() {
  if (!window.db) {
    console.warn('window.db не готовий, спробуємо ще раз через 300мс');
    setTimeout(loadRoutes, 300);
    return;
  }

  let data = [];
  let error = null;

  try {
    const routesTable = window.getTableName ? window.getTableName('routes') : 'routes';
    const result = await window.db
      .from(routesTable)
      .select('*');
    data = result.data || [];
    error = result.error || null;
  } catch (err) {
    error = err;
  }

  if (error) {
    console.warn('Load error from DB routes table, fallback to local routes.json:', error);
  }

  if (!data.length) {
    const localRoutes = await loadLocalRoutesFallback();
    if (localRoutes.length) {
      data = localRoutes.map((route, idx) => ({ data: route, id: route._rowId || `local-${idx}` }));
      console.info('Завантажено маршрути з локального JSON:', data.length);
    }
  }

  // Зберігаємо також id рядка з БД, щоб мати змогу оновлювати запис
  window.JABIL_ROUTES = data.map((d, idx) => {
    const route = (d && typeof d === 'object' && d.data && typeof d.data === 'object') ? d.data : d;
    return {
      ...route,
      _rowId: d.id || route._rowId || `local-${idx}`
    };
  });

  // console.info('loadRoutes: routes loaded', window.JABIL_ROUTES.length, window.JABIL_ROUTES);
  await ensureSettlementsLoaded();

  // Resolve stop coordinates from local settlements data
  for (const route of window.JABIL_ROUTES) {
    route.stops = (route.stops || []).map(stop => {
      let name = null;
      let lat = null;
      let lng = null;
      let people = null;

      if (typeof stop === 'string') {
        name = stop;
      } else if (stop && typeof stop === 'object') {
        name = stop.name || stop.city || null;
        lat = stop.lat;
        lng = stop.lng;
        people = stop.people;
      }

      if (!name || !name.toString().trim()) return null;
      const normalizedName = name.toString().trim();
      const result = { name: normalizedName, people: people || { A: 0, B: 0, C: 0, D: 0, Офіс: 0 } };

      if (lat == null || lng == null) {
        const settlement = findSettlementByName(normalizedName);
        if (settlement) {
          lat = settlement.lat;
          lng = settlement.lng;
        } else {
          console.warn('Не вдалося знайти координати для зупинки маршруту:', normalizedName, 'маршрут:', route.route_code);
        }
      }

      result.lat = lat;
      result.lng = lng;
      if (typeof result.lat !== 'number' || typeof result.lng !== 'number') return null;
      return result;
    }).filter(Boolean);

    if (!route.stops.length) {
      console.warn('Маршрут без зупинок, пропускаємо:', route.route_code, route);
    }
  }

  // Fetch people once and compute counts
  const people = await fetchAllPeople();
  const cityShiftMap = await calculatePeopleByCity(people);
  const currentShiftInfo = getCurrentShiftNow(new Date());
  const currentShift = currentShiftInfo.current;

  for (const route of window.JABIL_ROUTES) {
    const routeShifts = parseRouteShifts(route.shifts);
    if (routeShifts.length) {
      route._allowedShifts = routeShifts;
    } else if (route.type === 'office') {
      route._allowedShifts = ['Офіс'];
    } else {
      // fallback for legacy routes without configured shifts
      route._allowedShifts = [currentShift];
    }

    let totalPeople = 0;
    for (const stop of route.stops) {
      const city = stop.name.trim();
      if (cityShiftMap[city]) {
        const allShiftCounts = {
          A: cityShiftMap[city].A || 0,
          B: cityShiftMap[city].B || 0,
          C: cityShiftMap[city].C || 0,
          D: cityShiftMap[city].D || 0,
          Офіс: cityShiftMap[city].Офіс || 0
        };

        stop._allShiftPeople = allShiftCounts;
        stop.people = {
          A: route._allowedShifts.includes('A') ? allShiftCounts.A : 0,
          B: route._allowedShifts.includes('B') ? allShiftCounts.B : 0,
          C: route._allowedShifts.includes('C') ? allShiftCounts.C : 0,
          D: route._allowedShifts.includes('D') ? allShiftCounts.D : 0,
          Офіс: route._allowedShifts.includes('Офіс') ? allShiftCounts.Офіс : 0
        };

        const stopAllowedTotal = route._allowedShifts.reduce((sum, shift) => sum + (stop.people[shift] || 0), 0);
        totalPeople += stopAllowedTotal;
        stop._routePeople = stopAllowedTotal;
      } else {
        stop._allShiftPeople = stop._allShiftPeople || {A:0,B:0,C:0,D:0,Офіс:0};
        stop.people = {
          A: route._allowedShifts.includes('A') ? 0 : 0,
          B: route._allowedShifts.includes('B') ? 0 : 0,
          C: route._allowedShifts.includes('C') ? 0 : 0,
          D: route._allowedShifts.includes('D') ? 0 : 0,
          Офіс: route._allowedShifts.includes('Офіс') ? 0 : 0
        };
        stop._routePeople = 0;
      }
    }
    route.people = totalPeople;
    route._computedForShift = (route._allowedShifts || []).join(',');
  }

  updateRoutesOnMap();
  loadAndDrawPeople(people);
  renderRouteFilterBanner();

}

loadRoutes();

// Авто-перезавантаження маршрутів і людей кожні 5 хвилин, щоб підхоплювати оновлений `people.json`
setInterval(() => {
  console.log('Auto reloading routes and people...');
  loadRoutes();
}, 5 * 60 * 1000);

// Оновлення маршрутів на мапі
async function updateRoutesOnMap() {
  // Видалити всі старі шари (крім базових)
  map.eachLayer(function (layer) {
    if (layer instanceof L.CircleMarker || layer instanceof L.GeoJSON || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
  // Додаємо маркер заводу Jabil
  var jabilMarker = L.marker([48.581767, 22.264624]).addTo(map)
    .bindPopup('<b>Завод Jabil</b><br>с. Розівка, вул. Концівська, 40');

  // Додати глобальний обробник popupopen для кнопок "Показати точний маршрут" (тільки раз)
  if (!window._routePopupHandlerAdded) {
    map.on('popupopen', async function (e) {
      const node = e.popup && e.popup._contentNode;
      if (!node) return;

      const btn = node.querySelector('.load-geo');
      if (!btn) return;
      
      const rowId = btn.dataset.route;
      const route = window.JABIL_ROUTES && window.JABIL_ROUTES.find(r => String(r._rowId) === String(rowId));
      if (!route) {
        console.warn('Route not found for rowId:', rowId);
        return;
      }
      
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        btn.textContent = 'Завантаження...';
        try {
          const key = route.stops.map(s => `${s.lat},${s.lng}`).join('|');
          const geo = await fetchRouteWithCache(route);
          if (geo && geo.features && geo.features[0]) {
            const realLayer = L.geoJSON(geo, { style: { color: route.color, weight: 4 } }).addTo(map);
            attachRoutePopupHandlers(realLayer, route);
            // видаляємо швидку лінію якщо була
            if (route._quickLine) {
              try {
                map.removeLayer(route._quickLine);
                route._quickLine = null;
              } catch (err) {
                console.warn('Could not remove quickLine:', err);
              }
            }
            window.routeGeoCache[key] = geo;
          } else {
            alert('Не вдалося побудувати маршрут.');
            btn.disabled = false;
            btn.textContent = 'Показати точний маршрут';
          }
        } catch (err) {
          console.error('Error loading geometry', err);
          alert('Помилка при завантаженні маршруту: ' + (err.message || err));
          btn.disabled = false;
          btn.textContent = 'Показати точний маршрут';
        }
      }, { once: true });
    });
    window._routePopupHandlerAdded = true;
  }
  for (const route of window.JABIL_ROUTES) {
    // Відображаємо зупинки
    route._stopMarkers = [];
    
    for (const stop of route.stops) {
      const total = typeof stop._routePeople === 'number'
        ? stop._routePeople
        : (stop.people.A + stop.people.B + stop.people.C + stop.people.D + (stop.people.Офіс || 0));
      let table = `<table style='font-size:1em;border-collapse:collapse;margin-top:4px;'>
        <tr><th colspan='6' style='text-align:center;'>Кількість працівників по змінах</th></tr>
        <tr><th>Зміна</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Офіс</th></tr>
        <tr><td>К-сть</td><td>${stop.people.A}</td><td>${stop.people.B}</td><td>${stop.people.C}</td><td>${stop.people.D}</td><td>${stop.people.Офіс || 0}</td></tr>
        <tr style='font-weight:bold;background:#f5f5f5;'><td>Всього</td><td>${stop.people.A}</td><td>${stop.people.B}</td><td>${stop.people.C}</td><td>${stop.people.D}</td><td>${stop.people.Офіс || 0}</td></tr>
      </table>`;
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 6 + Math.log2(Math.max(1, total)),
        color: route.color,
        fillOpacity: 0.8
      })
        .addTo(map)
        .bindPopup(`<b>${stop.name}</b>${table}`);
      route._stopMarkers.push(marker);
    }
    const key = route.stops.map(s => `${s.lat},${s.lng}`).join('|');
    const cached = window.routeGeoCache[key] || route.geojson;
    if (cached && cached.features && cached.features[0]) {
      const layer = L.geoJSON(cached, { style: { color: route.color, weight: 4 } }).addTo(map);
      layer.bindPopup(createRoutePopupHtml(route, false));
      attachRoutePopupHandlers(layer, route);
      route._routeLine = layer;
    } else {
      const coords = route.stops
        .map(s => {
          const lat = Number(s.lat);
          const lng = Number(s.lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          return [lat, lng];
        })
        .filter(Boolean);
      const fallbackLine = L.polyline(coords, { color: route.color, weight: 4 }).addTo(map);
      fallbackLine.bindPopup(createRoutePopupHtml(route, true));
      attachRoutePopupHandlers(fallbackLine, route);
      route._routeLine = fallbackLine;
    }
  }

  const searchInput = document.getElementById('searchPerson');
  if (searchInput) {
    syncRouteFilterBanner();
  }
}

// ===== ВІДОБРАЖЕННЯ ЛЮДЕЙ =====

// Глобальні змінні для пошуку
window.allPeople = [];
window.personMarkers = {}; // { cityName: [{ person, marker }, ...] }
window.currentSearchResults = [];

function searchPersonAndHighlight(query) {
  // Очистити попередній результат
  window.currentSearchResults.forEach(marker => {
    if (marker._originalRadius !== undefined) marker.setRadius(marker._originalRadius);
    if (marker._originalColor !== undefined) marker.setStyle({ color: marker._originalColor });
    if (marker._path && marker._path.classList) marker._path.classList.remove('search-highlight');
  });
  window.currentSearchResults = [];

  if (!query || !query.trim()) {
    return;
  }

  const lowerQuery = query.toLowerCase().trim();
  
  // Шукаємо людей по імені або місту
  const found = window.allPeople.filter(p => {
    const nameMatch = (p.name || '').toLowerCase().includes(lowerQuery);
    const cityMatch = (p.city || '').toLowerCase().includes(lowerQuery);
    return nameMatch || cityMatch;
  });

  if (found.length === 0) return;

  const bounds = L.latLngBounds();
  let foundAny = false;

  // Шукаємо маркери по місту
  found.forEach(p => {
    const cityRaw = (p.city || '').trim();
    if (!cityRaw) return;

    for (const key in window.personMarkers) {
      if (!window.personMarkers[key] || !Array.isArray(window.personMarkers[key])) continue;
      
      // Простіше порівняння без normalize
      const keyLower = key.toLowerCase();
      const cityLower = cityRaw.toLowerCase();
      if (keyLower.includes(cityLower) || cityLower.includes(keyLower)) {
        window.personMarkers[key].forEach(markerObj => {
          const marker = markerObj && markerObj.marker ? markerObj.marker : markerObj;
          if (!marker) return;
          
          marker._originalRadius = marker._originalRadius || (marker.getRadius ? marker.getRadius() : 8);
          marker._originalColor = marker._originalColor || (marker.options && marker.options.color ? marker.options.color : '#FF6D00');
          
          marker.setRadius((marker._originalRadius || 8) + 4);
          marker.setStyle({ color: '#a855f7', weight: 4, className: 'search-highlight' });
          if (marker._path && marker._path.classList) marker._path.classList.add('search-highlight');
          window.currentSearchResults.push(marker);
          
          try {
            bounds.extend(marker.getLatLng());
            foundAny = true;
          } catch (e) {}
        });
      }
    }
  });

  // Фокусимо на знайденому
  if (foundAny && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 });
  }
}

function setupSearchInput() {
  const searchInput = document.getElementById('searchPerson');
  if (!searchInput || searchInput.dataset.bound === '1') return;

  searchInput.dataset.bound = '1';

  const handleSearch = (e) => {
    searchPersonAndHighlight(e.target.value);
  };

  searchInput.addEventListener('input', handleSearch);
  searchInput.addEventListener('keyup', handleSearch);
  searchInput.addEventListener('search', handleSearch);

  if (searchInput.value && searchInput.value.trim()) {
    searchPersonAndHighlight(searchInput.value);
  }
}

setupSearchInput();
document.addEventListener('DOMContentLoaded', setupSearchInput);

async function loadAndDrawPeople(providedPeople) {
  // Використовуємо надані дані або централізований fetchAllPeople, щоб уникнути дублювання запитів
  const people = providedPeople || await fetchAllPeople();
  await ensureSettlementsLoaded();

  if (!window.settlementsList || !window.settlementsList.length) {
    console.warn('Settlement list is not available, cannot draw people markers.');
    return;
  }

  const cityMap = {};

  // ✅ групування
  people.forEach(p => {
    const cityRaw = (p.city || '').trim();
    if (!cityRaw) return;

    const city = cityRaw.toLowerCase();
    const shift = normalizeShiftValue(p.shift);
    if (!shift) return;

    if (!cityMap[city]) {
      cityMap[city] = { A: 0, B: 0, C: 0, D: 0, Офіс: 0, total: 0 };
    }

    cityMap[city][shift]++;
    cityMap[city].total++;
  });

  // ✅ максимум
  const max = Math.max(...Object.values(cityMap).map(c => c.total));

  // ✅ layer
  if (!window.peopleLayer) {
    window.peopleLayer = L.layerGroup().addTo(map);
  } else {
    window.peopleLayer.clearLayers();
  }

  // ✅ ГРАДІЄНТ
  function getColor(value) {
    const threshold = 40;

    // обмеження значення
    if (value >= threshold) value = threshold;

    const ratio = value / threshold; // 0 → 1

    // 10 сегментів (по 10%)
    if (ratio < 0.1) {
      return interpolateColor([255, 0, 0], [255, 80, 0], ratio / 0.1); // 🔴 → темно-оранжевий
    } else if (ratio < 0.2) {
      return interpolateColor([255, 80, 0], [255, 140, 0], (ratio - 0.1) / 0.1);
    } else if (ratio < 0.3) {
      return interpolateColor([255, 140, 0], [255, 200, 0], (ratio - 0.2) / 0.1);
    } else if (ratio < 0.4) {
      return interpolateColor([255, 200, 0], [255, 255, 0], (ratio - 0.3) / 0.1);
    } else if (ratio < 0.5) {
      return interpolateColor([255, 255, 0], [180, 255, 0], (ratio - 0.4) / 0.1);
    } else if (ratio < 0.6) {
      return interpolateColor([180, 255, 0], [100, 255, 0], (ratio - 0.5) / 0.1);
    } else if (ratio < 0.7) {
      return interpolateColor([100, 255, 0], [0, 255, 0], (ratio - 0.6) / 0.1);
    } else if (ratio < 0.8) {
      return interpolateColor([0, 255, 0], [0, 220, 0], (ratio - 0.7) / 0.1);
    } else if (ratio < 0.9) {
      return interpolateColor([0, 220, 0], [0, 200, 0], (ratio - 0.8) / 0.1);
    } else {
      return interpolateColor([0, 200, 0], [0, 180, 0], (ratio - 0.9) / 0.1);
    }
  }


  function interpolateColor(color1, color2, factor) {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * factor);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * factor);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }


  // ✅ РОЗМІР
  function getRadius(value) {
    const size = 10 + (value - 1);
    return Math.min(size, 40); // щоб не були величезні
  }

  // ✅ малювання
  window.personMarkers = {}; // очистити маркери перед перемальовуванням
  window.allPeople = people; // зберегти всіх людей для пошуку

  for (const city in cityMap) {
    const data = cityMap[city];

    let settlement = await resolveSettlement(city);
    if (!settlement) {
      settlement = window.settlementsList.find(
        s => normalize(s.name).includes(normalize(city))
      );
    }

    if (!settlement) {
      settlement = window.settlementsList.find(
        s => normalize(city).includes(normalize(s.name))
      );
    }

    if (!settlement) {
      console.warn("НЕ ЗНАЙШОВ НП:", city);
      continue;
    }

    const color = getColor(data.total);
    const radius = getRadius(data.total);
    const popup = `
      <b>${settlement.name}</b><br>
      <table style="border-collapse:collapse;text-align:center">
        <tr><th>A</th><th>B</th><th>C</th><th>D</th><th>Офіс</th><th>Всього</th></tr>
        <tr>
          <td>${data.A}</td>
          <td>${data.B}</td>
          <td>${data.C}</td>
          <td>${data.D}</td>
          <td>${data.Офіс}</td>
          <td><b>${data.total}</b></td>
        </tr>
      </table>
    `;

    const marker = L.circleMarker([settlement.lat, settlement.lng], {
      radius,
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 1
    }).addTo(window.peopleLayer);

    marker._originalRadius = radius;
    marker._originalColor = color;

    if (!window.personMarkers[settlement.name]) {
      window.personMarkers[settlement.name] = [];
    }
    window.personMarkers[settlement.name].push(marker);

    marker.bindTooltip(`${settlement.name} (${data.total})`, {
      permanent: true,
      direction: 'top',
      offset: [0, -radius - 5],
      className: 'circle-label'
    });

    marker.bindPopup(popup);
  }
}

async function loadPeople() {
  const peopleTable = window.getTableName ? window.getTableName('people') : 'people';
  const { data, error } = await window.db
    .from(peopleTable)
    .select('*');

  console.log("LOADED PEOPLE:", data, error);

  if (error) return;

  drawPeopleOnMap(data);
}


function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/’/g, '')
    .replace(/і/g, 'и')   // нормалізація
    .replace(/ї/g, 'и')
    .replace(/є/g, 'е')
    .replace(/\s+/g, ''); // прибрати пробіли
}

async function resolveSettlement(city) {
  await ensureSettlementsLoaded();
  return findSettlementByName(city);
}

