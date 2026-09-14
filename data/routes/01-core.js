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
  if (!window.db || typeof window.db.from !== 'function') {
    return Array.isArray(window.settlementsList) ? window.settlementsList : [];
  }

  try {
    const settlementTable = window.getTableName ? window.getTableName('settlements') : 'settlements';
    const { data: dbSettlements, error } = await window.db.from(settlementTable).select('*');
    if (error) {
      console.warn('Failed to refresh settlements from DB:', error.message || error);
      return Array.isArray(window.settlementsList) ? window.settlementsList : [];
    }

    const baseList = Array.isArray(window.settlementsList) ? window.settlementsList : [];
    const merged = new Map();

    for (const item of baseList) {
      if (item && item.name) merged.set(normalizeSettlementName(item.name), item);
    }

    for (const item of Array.isArray(dbSettlements) ? dbSettlements : []) {
      if (item && item.name) merged.set(normalizeSettlementName(item.name), item);
    }

    window.settlementsList = Array.from(merged.values());
    return window.settlementsList;
  } catch (err) {
    console.warn('refreshSettlementsFromDb failed:', err);
    return Array.isArray(window.settlementsList) ? window.settlementsList : [];
  }
}

async function ensureSettlementsLoaded() {
  if (window.settlementsList && Array.isArray(window.settlementsList) && window.settlementsList.length) {
    return await refreshSettlementsFromDb();
  }

  try {
    const response = await fetch('data/settlements.json');
    if (!response.ok) {
      throw new Error('Failed to load settlements.json');
    }
    const list = await response.json();
    window.settlementsList = Array.isArray(list) ? list : [];
    return await refreshSettlementsFromDb();
  } catch (err) {
    console.error('Error loading settlements data:', err);
    return await refreshSettlementsFromDb();
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

