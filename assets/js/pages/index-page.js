// Center map on Rozivka
var map = L.map('map').setView([48.6175, 22.2731], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Jabil marker
var jabilMarker = L.marker([48.581767, 22.264624]).addTo(map)
  .bindPopup('<b>Завод Jabil</b><br>с. Розівка, вул. Концівська, 40');

// Interactive route stop picking on main map
map.on('click', function (e) {
  if (!window.pickMode) return;

  const { lat, lng } = e.latlng;
  const settlement = findNearestSettlement(lat, lng);

  let name = null;
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
    if (!name) return;
  }

  if (!window.pickedStops.find(s => s.name === name)) {
    window.pickedStops.push({
      name,
      lat: finalLat,
      lng: finalLng,
      people: { A: 0, B: 0, C: 0, D: 0 }
    });

    window.updatePickedStopsList();
  }
});

L.control.attribution({ position: 'bottomleft' }).addAttribution('Маршрути: <b>09А</b>, <b>12B</b>, <b>15C</b>, <b>21D</b> — різні кольори, кількість працівників у підказці');

window.createAppDb();

// Load routes logic via stable entrypoint.
const routesBootstrap = document.createElement('script');
routesBootstrap.src = 'data/routes.js';
routesBootstrap.async = false;
document.body.appendChild(routesBootstrap);

window.initBurgerMenu('burgerMenuBtn', 'burgerMenu');
