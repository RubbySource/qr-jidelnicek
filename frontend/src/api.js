const TOKEN_KEY = 'qrj_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, url, body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

export const api = {
  getMenu: (slug) => request('GET', `/api/menu/${slug}`),
  qrUrl: (slug) => `/api/qr/${slug}`,
  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  me: () => request('GET', '/api/admin/me', null, true),
  myMenu: () => request('GET', '/api/admin/menu', null, true),
  createCategory: (payload) => request('POST', '/api/admin/categories', payload, true),
  updateCategory: (id, payload) => request('PUT', `/api/admin/categories/${id}`, payload, true),
  reorderCategory: (id, position) => request('PUT', `/api/admin/categories/${id}/order`, { position }, true),
  deleteCategory: (id) => request('DELETE', `/api/admin/categories/${id}`, null, true),
  createItem: (payload) => request('POST', '/api/admin/items', payload, true),
  updateItem: (id, payload) => request('PUT', `/api/admin/items/${id}`, payload, true),
  reorderItem: (id, position) => request('PUT', `/api/admin/items/${id}/order`, { position }, true),
  setItemAvailability: (id, available) => request('PATCH', `/api/admin/items/${id}/availability`, { available }, true),
  deleteItem: (id) => request('DELETE', `/api/admin/items/${id}`, null, true),
};
