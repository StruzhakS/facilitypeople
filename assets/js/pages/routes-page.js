window.db = window.createAppDb();
const tables = window.getTenantTables();

let routes = [];

window.initBurgerMenu('burgerMenuBtn', 'burgerMenu');

async function loadRoutes() {
  try {
    const res = await fetch('data/routes.json');
    const fileData = await res.json();
    let fileRoutes = [];

    if (Array.isArray(fileData)) {
      fileRoutes = fileData;
    } else if (fileData && Array.isArray(fileData.data)) {
      fileRoutes = fileData.data;
    }

    const { data: dbRows, error: dbError } = await window.db.from(tables.routes).select('id,data');
    if (dbError) {
      console.error('Error loading routes from DB:', dbError);
    }

    const dbRoutes = (dbRows || [])
      .map(row => ({ ...(row.data || {}), _rowId: row.id }))
      .filter(route => route && route.route_code);

    routes = [...fileRoutes, ...dbRoutes];
    renderRoutes();
  } catch (err) {
    console.error('Error loading routes:', err);
  }
}

function renderRoutes() {
  const tbody = document.getElementById('routesList');

  tbody.innerHTML = routes.map((r, idx) => `
    <tr>
      <td><strong>${r.route_code || ''}</strong></td>
      <td><div class="color-preview" style="background:${r.color || '#ccc'};"></div></td>
      <td>${Array.isArray(r.shifts) ? r.shifts.join(', ') : '-'}</td>
      <td>${Array.isArray(r.stops) ? r.stops.length : 0}</td>
      <td>${r.type === 'office' ? 'Офісний' : 'Позмінний'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" onclick="openRouteEditorFromList(${idx})">✏️ Редагувати</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRoute('${r._rowId || r.id || ''}')">🗑️ Видалити</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openRouteEditorFromList = function (index) {
  const route = routes[index];
  if (!route) return;

  if (typeof window.openRouteModalForEdit !== 'function') {
    alert('Логіка редагування ще не ініціалізована');
    return;
  }

  window.openRouteModalForEdit(route);
};

window.deleteRoute = async (id) => {
  if (!confirm('Видалити маршрут?')) return;
  try {
    await window.db.from(tables.routes).delete().eq('id', id);
    loadRoutes();
  } catch (err) {
    alert('Помилка: ' + err.message);
  }
};

loadRoutes();
