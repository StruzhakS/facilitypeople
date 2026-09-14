window.APP_CONFIG = {
  supabaseUrl: 'https://rfoxmxrqimocnxfwurph.supabase.co',
  supabaseAnonKey: 'sb_publishable_GMB0eeSai-OlnYJbJC6DJg_0W1um1-O',
  tenant: 'facility',
  tables: {
    people: 'people_facility',
    routes: 'routes_facility',
    settlements: 'settlements_facility'
  }
};

window.getSelectedTenant = function getSelectedTenant() {
  return window.APP_CONFIG.tenant;
};

window.getTenantTables = function getTenantTables() {
  return window.APP_CONFIG.tables;
};

window.getTableName = function getTableName(kind) {
  return window.APP_CONFIG.tables[kind] || kind;
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
