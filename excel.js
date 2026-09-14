// SheetJS (xlsx) підключається через CDN
// Додаємо обробку завантаження Excel-файлу

const _uploadExcelBtn = document.getElementById('uploadExcelBtn');
if (_uploadExcelBtn) _uploadExcelBtn.onclick = function () {
  const _excelInputBtn = document.getElementById('excelInput');
  if (_excelInputBtn) _excelInputBtn.click();
};

const _excelInput = document.getElementById('excelInput');
if (_excelInput) _excelInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    const data = evt.target.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    // Беремо перший лист
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    // Витягуємо потрібні колонки
    const people = json.map(row => ({
      settlement: row['Населений пункт'] || row['Населений пунк'] || row['Населений пункт '],
      shift: row['Зміна2'] || row['Зміна 2'] || row['Зміна']
    })).filter(p => p.settlement && p.shift);
    // Додаємо людей у маршрути
    if (people.length === 0) {
      alert('Не знайдено жодного запису з "Населений пункт" і "Зміна2"');
      return;
    }
    addPeopleFromExcel(people);
  };
  reader.readAsBinaryString(file);
});

// Додаємо людей у маршрути
async function addPeopleFromExcel(people) {
  if (!window.JABIL_ROUTES || window.JABIL_ROUTES.length === 0) {
    // Якщо немає маршрутів — створити новий
    window.JABIL_ROUTES = [{
      route_code: 'EXCEL',
      color: '#888',
      people: 0,
      stops: []
    }];
  }
  for (const p of people) {
    let found = false;
    for (const route of window.JABIL_ROUTES) {
      for (const stop of route.stops) {
        if (stop.name.toLowerCase() === p.settlement.toLowerCase()) {
          stop.people[p.shift] = (stop.people[p.shift] || 0) + 1;
          found = true;
        }
      }
    }
    if (!found && window.JABIL_ROUTES.length > 0) {
      const s = window.settlementsList.find(
        x => x.name.toLowerCase() === p.settlement.toLowerCase()
      );

      if (s) {
        window.JABIL_ROUTES[0].stops.push({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          people: { A: 0, B: 0, C: 0, D: 0, [p.shift]: 1 }
        });
      }
      // throttle: 1.2 сек між запитами
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  if (typeof window.JABIL_UPDATE === 'function') window.JABIL_UPDATE();
  if (typeof renderRoutesList === 'function') renderRoutesList();
  alert('Дані з Excel додано!');
}
