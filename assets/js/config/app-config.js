window.APP_CONFIG = {
  supabaseUrl: 'https://rfoxmxrqimocnxfwurph.supabase.co',
  supabaseAnonKey: 'sb_publishable_GMB0eeSai-OlnYJbJC6DJg_0W1um1-O',
  tenant: 'manufacturing',
  tenantTableMap: {
    manufacturing: {
      people: 'people',
      routes: 'routes',
      settlements: 'settlements'
    },
    facility: {
      people: 'people_facility',
      routes: 'routes_facility',
      settlements: 'settlements_facility'
    }
  }
};

window.getSelectedTenant = function getSelectedTenant() {
  try {
    const stored = localStorage.getItem('jabil_selected_tenant');
    if (stored && window.APP_CONFIG.tenantTableMap[stored]) {
      window.APP_CONFIG.tenant = stored;
      return stored;
    }
  } catch (err) {
    console.warn('localStorage unavailable:', err);
  }

  return window.APP_CONFIG.tenant || 'manufacturing';
};

window.setSelectedTenant = function setSelectedTenant(tenant) {
  const validTenant = window.APP_CONFIG.tenantTableMap[tenant] ? tenant : 'manufacturing';
  window.APP_CONFIG.tenant = validTenant;

  try {
    localStorage.setItem('jabil_selected_tenant', validTenant);
  } catch (err) {
    console.warn('Could not save tenant to localStorage:', err);
  }

  if (typeof window.renderTenantBanner === 'function') {
    window.renderTenantBanner();
  }

  return validTenant;
};

window.getTenantTables = function getTenantTables() {
  const tenant = window.getSelectedTenant();
  return window.APP_CONFIG.tenantTableMap[tenant] || window.APP_CONFIG.tenantTableMap.manufacturing;
};

window.getTableName = function getTableName(kind) {
  const tables = window.getTenantTables();
  return tables[kind] || kind;
};

window.getTenantDisplayName = function getTenantDisplayName(tenant) {
  const selected = tenant || window.getSelectedTenant();
  if (selected === 'facility') return 'Facility';
  return 'Manufacturing';
};

window.renderTenantBanner = function renderTenantBanner() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const appPages = ['index.html', 'people.html', 'routes.html'];

  if (!appPages.includes(currentPage)) {
    return null;
  }

  let banner = document.getElementById('tenantStatusBanner');

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'tenantStatusBanner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.zIndex = '10000';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.gap = '10px';
    banner.style.padding = '6px 12px';
    banner.style.boxSizing = 'border-box';
    banner.style.fontSize = '12px';
    banner.style.fontWeight = '600';
    banner.style.letterSpacing = '0.03em';
    banner.style.lineHeight = '1.3';
    banner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    banner.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(banner);
  }

  const tenant = window.getSelectedTenant();
  const tenantName = window.getTenantDisplayName(tenant);
  banner.textContent = `Відділ: ${tenantName}`;
  banner.title = `Активний відділ: ${tenantName}`;

  if (tenant === 'facility') {
    banner.style.background = '#1f7a45';
    banner.style.color = '#fff';
  } else {
    banner.style.background = '#1f2937';
    banner.style.color = '#fff';
  }

  const body = document.body;
  if (body) {
    body.style.paddingTop = '32px';
  }

  if (!banner.querySelector('.tenant-switch-btn')) {
    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.textContent = 'Змінити';
    switchBtn.className = 'tenant-switch-btn';
    switchBtn.style.marginLeft = '8px';
    switchBtn.style.padding = '4px 10px';
    switchBtn.style.border = '1px solid rgba(255,255,255,0.5)';
    switchBtn.style.borderRadius = '999px';
    switchBtn.style.background = 'rgba(255,255,255,0.12)';
    switchBtn.style.color = '#fff';
    switchBtn.style.cursor = 'pointer';
    switchBtn.style.fontSize = '11px';
    switchBtn.style.fontWeight = '700';
    switchBtn.onclick = () => {
      localStorage.removeItem('jabil_selected_tenant');
      window.location.reload();
    };
    banner.appendChild(switchBtn);
  }

  return banner;
};

window.createAppDb = function createAppDb() {
  if (window.db) return window.db;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase SDK is not loaded');
  }

  window.db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseAnonKey
  );

  return window.db;
};

window.initTenantSelectionModal = function initTenantSelectionModal() {
  let hasStoredSelection = false;

  try {
    hasStoredSelection = Boolean(localStorage.getItem('jabil_selected_tenant'));
  } catch (err) {
    console.warn('localStorage unavailable during tenant modal init:', err);
  }

  if (hasStoredSelection) {
    return;
  }

  if (document.getElementById('tenantSelectorModal')) return;

  const modal = document.createElement('div');
  modal.id = 'tenantSelectorModal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.65)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.borderRadius = '12px';
  box.style.padding = '24px';
  box.style.maxWidth = '420px';
  box.style.width = '90%';
  box.style.boxShadow = '0 12px 40px rgba(0,0,0,.25)';
  box.style.textAlign = 'center';

  const title = document.createElement('h3');
  title.textContent = 'З якого Ви відділу?';
  title.style.marginBottom = '18px';

  const buttonsRow = document.createElement('div');
  buttonsRow.style.display = 'flex';
  buttonsRow.style.justifyContent = 'center';
  buttonsRow.style.gap = '12px';

  const manufacturingBtn = document.createElement('button');
  manufacturingBtn.textContent = 'Manufacturing';
  manufacturingBtn.style.padding = '12px 18px';
  manufacturingBtn.style.borderRadius = '8px';
  manufacturingBtn.style.border = 'none';
  manufacturingBtn.style.cursor = 'pointer';
  manufacturingBtn.style.background = '#dfeafc';
  manufacturingBtn.style.color = '#123';
  manufacturingBtn.style.fontWeight = '600';

  const facilityBtn = document.createElement('button');
  facilityBtn.textContent = 'Facility';
  facilityBtn.style.padding = '12px 18px';
  facilityBtn.style.borderRadius = '8px';
  facilityBtn.style.border = 'none';
  facilityBtn.style.cursor = 'pointer';
  facilityBtn.style.background = '#e6f7e8';
  facilityBtn.style.color = '#123';
  facilityBtn.style.fontWeight = '600';

  const applyTenant = (tenant) => {
    window.setSelectedTenant(tenant);
    modal.remove();
    window.location.reload();
  };

  manufacturingBtn.onclick = () => applyTenant('manufacturing');
  facilityBtn.onclick = () => applyTenant('facility');

  buttonsRow.appendChild(manufacturingBtn);
  buttonsRow.appendChild(facilityBtn);
  box.appendChild(title);
  box.appendChild(buttonsRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    window.renderTenantBanner();
    window.initTenantSelectionModal();
  });
} else {
  window.renderTenantBanner();
  window.initTenantSelectionModal();
}
