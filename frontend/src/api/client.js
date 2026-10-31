import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Attach token from localStorage on every request
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('grace_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Global 401 → redirect to login
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('grace_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default client;

// ── Convenience API modules ──────────────────────────────────────────────────

export const authApi = {
  login:  data => client.post('/auth/login', data),
  logout: ()   => client.post('/auth/logout'),
  me:     ()   => client.get('/auth/me'),
};

export const productsApi = {
  list:         params => client.get('/products', { params }),
  publicList:   params => client.get('/public/products', { params }),
  get:          id     => client.get(`/products/${id}`),
  publicGet:    id     => client.get(`/public/products/${id}`),
  publicShow:   id     => client.get(`/public/products/${id}`),
  create:       data   => client.post('/products', data),
  update:       (id, d)=> client.put(`/products/${id}`, d),
  remove:       id     => client.delete(`/products/${id}`),
  addVariant:   (pid, d) => client.post(`/products/${pid}/variants`, d),
  updateVariant:(pid, vid, d) => client.put(`/products/${pid}/variants/${vid}`, d),
  uploadImage:    (pid, formData) => client.post(`/products/${pid}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  setPrimaryImage:(pid, imgId) => client.post(`/products/${pid}/images/${imgId}/primary`),
  deleteImage:    (pid, imgId) => client.delete(`/products/${pid}/images/${imgId}`),
};

export const categoriesApi = {
  list:      params    => client.get('/public/categories', { params }),
  adminList: params    => client.get('/categories', { params }),
  create:    data      => client.post('/categories', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:    (id, data) => client.post(`/categories/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove:    id        => client.delete(`/categories/${id}`),
};

export const siteSettingsApi = {
  publicGet: ()     => client.get('/public/site-settings'),
  get:       ()     => client.get('/site-settings'),
  update:    data   => client.post('/site-settings', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const collectionsApi = {
  list: params => client.get('/public/collections', { params }),
};

export const customersApi = {
  list:   params   => client.get('/customers', { params }),
  get:    id       => client.get(`/customers/${id}`),
  create: data     => client.post('/customers', data),
  update: (id, d)  => client.put(`/customers/${id}`, d),
};

export const leadsApi = {
  list:    params  => client.get('/leads', { params }),
  get:     id      => client.get(`/leads/${id}`),
  create:  data    => client.post('/leads', data),
  update:  (id, d) => client.put(`/leads/${id}`, d),
  convert: (id, d) => client.post(`/leads/${id}/convert`, d),
};

export const salesApi = {
  list:       params   => client.get('/sales', { params }),
  get:        id       => client.get(`/sales/${id}`),
  create:     data     => client.post('/sales', data),
  post:       id       => client.post(`/sales/${id}/post`),
  void:       (id, d)  => client.post(`/sales/${id}/void`, d),
  addPayment: (id, d)  => client.post(`/sales/${id}/payments`, d),
  addReturn:  (id, d)  => client.post(`/sales/${id}/returns`, d),
};

export const suppliersApi = {
  list:   params  => client.get('/suppliers', { params }),
  create: data    => client.post('/suppliers', data),
  update: (id, d) => client.put(`/suppliers/${id}`, d),
};

export const purchasesApi = {
  list:         params     => client.get('/purchases', { params }),
  get:          id         => client.get(`/purchases/${id}`),
  create:       data       => client.post('/purchases', data),
  update:       (id, d)    => client.put(`/purchases/${id}`, d),
  createReceipt:(id, d)    => client.post(`/purchases/${id}/receive`, d),
  postReceipt:  (pid, rid) => client.post(`/purchases/${pid}/receipts/${rid}/post`),
};

export const inventoryApi = {
  list:      params  => client.get('/inventory', { params }),
  movements: params  => client.get('/inventory/movements', { params }),
  adjust:    data    => client.post('/inventory/adjust', data),
  stockList: params  => client.get('/inventory', { params: { per_page: 200, ...params } }),
};

export const reportsApi = {
  dashboard:   params => client.get('/reports/dashboard', { params }),
  dailySales:  params => client.get('/reports/daily-sales', { params }),
  stockOnHand: params => client.get('/reports/stock-on-hand', { params }),
  valuation:   ()     => client.get('/reports/stock-valuation'),
  outstanding: params => client.get('/reports/outstanding', { params }),
  purchases:   params => client.get('/reports/purchases', { params }),
  auditLog:    params => client.get('/reports/audit-log', { params }),
  staffActivity: params => client.get('/reports/staff-activity', { params }),
};

export const usersApi = {
  list:    ()       => client.get('/users'),
  create:  d        => client.post('/users', d),
  update:  (id, d)  => client.put(`/users/${id}`, d),
  remove:  id       => client.delete(`/users/${id}`),
  toggle:  id       => client.post(`/users/${id}/toggle`),
};

export const rolesApi = {
  list:              ()           => client.get('/roles'),
  updatePermissions: (id, perms)  => client.put(`/roles/${id}`, { permissions: perms }),
};
