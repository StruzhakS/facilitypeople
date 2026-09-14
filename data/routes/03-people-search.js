async function loadRoutes() {
  if (!window.db) {
    console.warn('window.db не готовий, спробуємо ще раз через 300мс');
    setTimeout(loadRoutes, 300);
    return;
  }

  let data = [];
  let error = null;

  try {
    const tableName = window.getTableName ? window.getTableName('routes') : 'routes';
    const result = await window.db
      .from(tableName)
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
  const tableName = window.getTableName ? window.getTableName('people') : 'people';
  const { data, error } = await window.db
    .from(tableName)
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


