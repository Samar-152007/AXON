// GrocIQ REST API Client
const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  // Handle FormData where browser sets content-type with boundary automatically
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.detail || data.message || `HTTP ${res.status}: Failed request`;
      throw new Error(errMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // Inventory Items
  getItems: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return request(`/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id) => request(`/items/${id}`),
  createItem: (item) => request('/items', { method: 'POST', body: item }),
  updateItem: (id, item) => request(`/items/${id}`, { method: 'PUT', body: item }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  recordItemOutcome: (id, outcome) => request(`/items/${id}/outcome`, { method: 'POST', body: outcome }),

  // Explainable Use First Recommendations
  getRecommendations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.tier && params.tier !== 'ALL') query.set('tier', params.tier);
    if (params.category && params.category !== 'All') query.set('category', params.category);
    const qs = query.toString();
    return request(`/recommendations${qs ? `?${qs}` : ''}`);
  },

  // Duplicate Warnings
  checkDuplicate: (name) => request(`/duplicates?name=${encodeURIComponent(name)}`),
  getAllDuplicateWarnings: () => request('/duplicates/all-warnings'),

  // Shopping List
  getShoppingList: () => request('/shopping-list'),
  addShoppingItem: (item) => request('/shopping-list', { method: 'POST', body: item }),
  updateShoppingItem: (id, item) => request(`/shopping-list/${id}`, { method: 'PUT', body: item }),
  deleteShoppingItem: (id) => request(`/shopping-list/${id}`, { method: 'DELETE' }),
  convertToInventory: (id) => request(`/shopping-list/${id}/convert-to-inventory`, { method: 'POST' }),

  // Outcomes & Analytics
  getOutcomes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.outcome_type && params.outcome_type !== 'all') query.set('outcome_type', params.outcome_type);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString();
    return request(`/outcomes${qs ? `?${qs}` : ''}`);
  },
  getOutcomesSummary: () => request('/outcomes/summary'),

  // Waste-to-Wealth Financial Engine
  getWasteToWealthSummary: () => request('/analytics/summary'),

  // Dashboard Summary
  getDashboard: () => request('/dashboard'),

  // Receipt Import
  extractReceipt: (formData) => request('/receipt/extract', { method: 'POST', body: formData }),
  parseReceipt: (formData) => request('/receipt/parse', { method: 'POST', body: formData }),
  confirmReceipt: (items) => request('/receipt/confirm', { method: 'POST', body: { items } }),

  // Admin / Sample Data
  resetSampleData: () => request('/admin/reset-sample-data', { method: 'POST' }),
  clearData: () => request('/admin/clear-data', { method: 'POST' }),
};
