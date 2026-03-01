const USE_SAME_ORIGIN_PROXY = import.meta.env.DEV && Boolean(import.meta.env.VITE_PROXY_TARGET);
const rawApiBase = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = USE_SAME_ORIGIN_PROXY ? '' : rawApiBase;

type FetchOptions = RequestInit & { skipAuth?: boolean };
type RetryableFetchOptions = FetchOptions & { _retry?: boolean };

const ACCESS_KEY = 'semed_access_token';
const REFRESH_KEY = 'semed_refresh_token';
export const AUTH_EXPIRED_EVENT = 'auth:expired';
const TOKEN_EXPIRY_SKEW_SECONDS = 30;

let refreshPromise: Promise<string | null> | null = null;
let hasNotifiedAuthExpired = false;

export const tokenStore = {
  getAccess() {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    hasNotifiedAuthExpired = false;
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

function notifyAuthExpired() {
  if (typeof window === 'undefined') return;
  if (hasNotifiedAuthExpired) return;
  hasNotifiedAuthExpired = true;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded?.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + TOKEN_EXPIRY_SKEW_SECONDS;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (!data?.access) return null;
      tokenStore.set(data.access, refresh);
      return data.access as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function apiFetch<T>(path: string, options: RetryableFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (!options.skipAuth) {
    let token = tokenStore.getAccess();
    const refresh = tokenStore.getRefresh();

    if ((!token && refresh) || (token && isTokenExpired(token))) {
      token = await tryRefreshAccessToken();
    }

    if (!token) {
      tokenStore.clear();
      notifyAuthExpired();
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();

    if ((response.status === 401 || response.status === 403) && !options.skipAuth) {
      const refreshedToken = options._retry ? null : await tryRefreshAccessToken();
      if (refreshedToken) {
        return apiFetch<T>(path, { ...options, _retry: true });
      }
      tokenStore.clear();
      notifyAuthExpired();
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    let parsedMessage = message;
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
        parsedMessage = parsed.detail;
      } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        parsedMessage = parsed.message;
      }
    } catch {
      // Keep raw text when body is not JSON.
    }

    throw new Error(parsedMessage || 'Erro na requisicao');
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text);
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ access: string; refresh: string }>('/api/auth/token/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  tokenStore.set(data.access, data.refresh);
  return data;
}

export async function getMe() {
  return apiFetch('/api/auth/me/');
}

export async function updateMe(payload: { name: string }) {
  return apiFetch('/api/auth/me/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getSchools(params?: { q?: string; city?: string; address?: string; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/schools/${search ? `?${search}` : ''}`);
}

export async function getSchoolStock(schoolId: string) {
  return apiFetch(`/api/schools/${schoolId}/stock/`);
}


export async function createSchool(payload: {
  name: string;
  address?: string;
  city?: string;
  is_active?: boolean;
}) {
  return apiFetch('/api/schools/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSchool(id: string, payload: Partial<{
  name: string;
  address: string;
  city: string;
  is_active: boolean;
}>) {
  return apiFetch(`/api/schools/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteSchool(id: string) {
  return apiFetch(`/api/schools/${id}/`, {
    method: 'DELETE',
  });
}

export async function getPublicLink(schoolId: string) {
  return apiFetch(`/api/schools/${schoolId}/public_link/`);
}

// Responsibles CRUD
export async function getResponsibles(params?: { q?: string; position?: string; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/responsibles/${search ? `?${search}` : ''}`);
}

export async function createResponsible(payload: {
  name: string;
  phone?: string;
  position?: string;
  is_active?: boolean;
}) {
  return apiFetch('/api/responsibles/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateResponsible(id: string, payload: Partial<{
  name: string;
  phone: string;
  position: string;
  is_active: boolean;
}>) {
  return apiFetch(`/api/responsibles/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteResponsible(id: string) {
  return apiFetch(`/api/responsibles/${id}/`, {
    method: 'DELETE',
  });
}

export async function getSuppliers(params?: { q?: string; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/suppliers/${search ? `?${search}` : ''}`);
}

export async function createSupplier(payload: {
  name: string;
  document?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active?: boolean;
}) {
  return apiFetch('/api/suppliers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSupplier(id: string) {
  return apiFetch(`/api/suppliers/${id}/`, {
    method: 'DELETE',
  });
}


export async function getStock(params?: { q?: string; category?: string; low_stock?: boolean; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/stock/${search ? `?${search}` : ''}`);
}

export async function getSupplies(params?: { q?: string; category?: string; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/supplies/${search ? `?${search}` : ''}`);
}

export async function getSupplyLots(supplyId: string, params?: { only_available?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/supplies/${supplyId}/lots/${search ? `?${search}` : ''}`);
}

export async function createSupply(payload: {
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  is_active?: boolean;
  nova_classification?: string;
  nutritional_function?: string;
}) {
  return apiFetch('/api/supplies/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSupply(id: string, payload: Partial<{
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  is_active: boolean;
  nova_classification: string;
  nutritional_function: string;
}>) {
  return apiFetch(`/api/supplies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getSupplyCategories(): Promise<string[]> {
  return apiFetch('/api/supplies/categories/');
}

export async function deleteSupply(id: string) {
  return apiFetch(`/api/supplies/${id}/`, {
    method: 'DELETE',
  });
}

export async function createStockMovement(payload: {
  supply: string;
  type: 'IN' | 'OUT';
  quantity: number;
  movement_date: string;
  note?: string;
}) {
  return apiFetch('/api/stock/movements/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getStockMovements(params?: { date_from?: string; date_to?: string; type?: 'IN' | 'OUT'; supply?: string; school?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/stock/movements/${search ? `?${search}` : ''}`);
}

export async function getDeliveries(params?: { school?: string; status?: string; conference_enabled?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/deliveries/${search ? `?${search}` : ''}`);
}

export async function getSupplierReceipts(params?: {
  supplier?: string;
  school?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/supplier-receipts/${search ? `?${search}` : ''}`);
}

export async function createSupplierReceipt(payload: {
  supplier: string;
  school?: string | null;
  expected_date: string;
  status?: string;
  notes?: string;
  items: Array<{
    supply?: string | null;
    raw_name?: string;
    category?: string;
    unit: string;
    expected_quantity: number;
  }>;
}) {
  return apiFetch('/api/supplier-receipts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSupplierReceipt(receiptId: string) {
  return apiFetch(`/api/supplier-receipts/${receiptId}/`, {
    method: 'DELETE',
  });
}

export async function startSupplierReceiptConference(receiptId: string) {
  return apiFetch(`/api/supplier-receipts/${receiptId}/start_conference/`, {
    method: 'POST',
  });
}

export async function submitSupplierReceiptConference(
  receiptId: string,
  payload: {
    items: Array<{
      item_id: string;
      received_quantity: number;
      note?: string;
      lots?: Array<{
        lot_code: string;
        expiry_date: string;
        manufacture_date?: string | null;
        received_quantity: number;
        note?: string;
      }>;
    }>;
    sender_signature_data: string;
    sender_signer_name: string;
    receiver_signature_data: string;
    receiver_signer_name: string;
  },
) {
  return apiFetch(`/api/supplier-receipts/${receiptId}/submit_conference/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createDelivery(payload: {
  school: string;
  delivery_date: string;
  responsible_name?: string;
  responsible_phone?: string;
  notes?: string;
  items: Array<{ supply: string; planned_quantity: number }>;
}) {
  return apiFetch('/api/deliveries/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDelivery(deliveryId: string, payload: {
  school: string;
  delivery_date: string;
  responsible_name?: string;
  responsible_phone?: string;
  notes?: string;
  items: Array<{ supply: string; planned_quantity: number }>;
}) {
  return apiFetch(`/api/deliveries/${deliveryId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function sendDelivery(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/send/`, {
    method: 'POST',
  });
}

export async function suggestDeliveryItemLots(deliveryId: string, itemId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/suggest_item_lots/`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId }),
  });
}

export async function getDeliveryConferenceLink(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/conference_link/`);
}

export async function copyDelivery(deliveryId: string, targetSchools: string[]) {
  return apiFetch(`/api/deliveries/${deliveryId}/copy/`, {
    method: 'POST',
    body: JSON.stringify({ target_schools: targetSchools }),
  });
}

export async function deleteDelivery(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/`, {
    method: 'DELETE',
  });
}

export async function getMenus(params: { school?: string; week_start?: string; week_end?: string; date_from?: string; date_to?: string; status?: string }) {
  const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  const search = new URLSearchParams(cleanParams as Record<string, string>).toString();
  return apiFetch(`/api/menus/${search ? `?${search}` : ''}`);
}

export async function createMenu(payload: {
  school: string;
  name?: string;
  week_start: string;
  week_end: string;
  status?: string;
  notes?: string;
  nutritional_info?: Record<string, { kcal: string; protein: string; carbs: string }>;
}) {
  return apiFetch('/api/menus/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMenu(id: string, payload: Partial<{
  name: string;
  week_start: string;
  week_end: string;
  status: string;
  notes: string;
  author_name: string;
  author_crn: string;
  nutritional_info: Record<string, { kcal: string; protein: string; carbs: string }>;
}>) {
  return apiFetch(`/api/menus/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function bulkMenuItems(menuId: string, items: Array<{
  day_of_week: string;
  meal_type: string;
  meal_name?: string;
  portion_text?: string;
  image_url?: string;
  image_data?: string;
  description: string;
  recipe?: string | null;
  calc_mode?: 'FREE_TEXT' | 'RECIPE';
}>) {
  return apiFetch(`/api/menus/${menuId}/items/bulk/`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function getRecipes(params?: { active?: boolean; search?: string; category?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/recipes/${search ? `?${search}` : ''}`);
}

export async function createRecipe(payload: {
  name: string;
  category?: string;
  servings_base: number;
  instructions?: string;
  tags?: Record<string, unknown>;
  active?: boolean;
  ingredients?: Array<{
    supply: string;
    qty_base: number;
    unit: string;
    optional?: boolean;
    notes?: string;
  }>;
}) {
  return apiFetch('/api/recipes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRecipe(id: string, payload: Partial<{
  name: string;
  category: string;
  servings_base: number;
  instructions: string;
  tags: Record<string, unknown>;
  active: boolean;
  ingredients: Array<{
    supply: string;
    qty_base: number;
    unit: string;
    optional?: boolean;
    notes?: string;
  }>;
}>) {
  return apiFetch(`/api/recipes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteRecipe(id: string) {
  return apiFetch(`/api/recipes/${id}/`, {
    method: 'DELETE',
  });
}

// ----------------------
// ENTRADAS / DELIVERIES
// ----------------------

export function signDelivery(id: string, signatureData: string, name: string, crn: string, role: string) {
  return apiFetch(`/api/deliveries/${id}/sign/`, {
    method: 'POST',
    body: JSON.stringify({
      signature_data: signatureData,
      name,
      crn,
      function_role: role,
    }),
  });
}

export function getDeliveryReceiptPdf(id: string) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`/api/deliveries/${id}/receipt_pdf/`, {
    method: 'GET',
    headers,
  }).then(res => {
    if (!res.ok) throw new Error('Não foi possível gerar o PDF.');
    return res.blob();
  });
}



export async function calculateMenuProduction(menuId: string, payload: {
  students_by_meal_type?: Record<string, number>;
  waste_percent?: number;
  include_stock?: boolean;
  rounding?: { mode?: 'UP' | 'NEAREST' | 'NONE'; decimals?: number };
}) {
  return apiFetch(`/api/menus/${menuId}/production/calculate/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPublicCalculatorMeta(token: string) {
  return apiFetch(`/public/calculator/${token}/meta/`, { skipAuth: true });
}

export async function calculatePublicMenuProduction(token: string, payload: {
  week_start: string;
  students_by_meal_type?: Record<string, number>;
  waste_percent?: number;
  include_stock?: boolean;
  rounding?: { mode?: 'UP' | 'NEAREST' | 'NONE'; decimals?: number };
}) {
  return apiFetch(`/public/calculator/${token}/calculate/`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function publishMenu(menuId: string) {
  return apiFetch(`/api/menus/${menuId}/publish/`, {
    method: 'POST',
  });
}

export async function copyMenu(menuId: string, payload: {
  target_schools: string[];
  week_start?: string;
  week_end?: string;
}) {
  return apiFetch(`/api/menus/${menuId}/copy/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


// List schools with published menus for current week
export async function getPublicSchools() {
  return apiFetch('/public/schools/', { skipAuth: true });
}

export async function getPublicMenuCurrent(slug: string, token?: string, menuDate?: string) {
  const encodedSlug = encodeURIComponent(slug);
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (menuDate) params.set('date', menuDate);
  const url = `/public/schools/${encodedSlug}/menu/current/${params.toString() ? `?${params.toString()}` : ''}`;
  return apiFetch(url, { skipAuth: true });
}

export async function calculatePublicMenuProductionBySchool(slug: string, payload: {
  week_start: string;
  students_by_meal_type?: Record<string, number>;
  waste_percent?: number;
  include_stock?: boolean;
  rounding?: { mode?: 'UP' | 'NEAREST' | 'NONE'; decimals?: number };
}) {
  const encodedSlug = encodeURIComponent(slug);
  return apiFetch(`/public/schools/${encodedSlug}/production/calculate/`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function getPublicRecipe(recipeId: string) {
  return apiFetch(`/public/recipes/${recipeId}/`, { skipAuth: true });
}

export async function getPublicDeliveryCurrent(slug: string, token: string, deliveryId: string) {
  const encodedSlug = encodeURIComponent(slug);
  const search = new URLSearchParams({ token, delivery_id: deliveryId }).toString();
  return apiFetch(`/public/schools/${encodedSlug}/delivery/current/?${search}`, { skipAuth: true });
}

export async function submitPublicDeliveryConference(
  slug: string,
  token: string,
  deliveryId: string,
  payload: {
    items: Array<{
      item_id: string;
      received_quantity: number;
      note?: string;
      lots?: Array<{ delivery_item_lot: string; received_quantity: number; note?: string }>;
    }>;
    sender_signature_data: string;
    sender_signer_name: string;
    receiver_signature_data: string;
    receiver_signer_name: string;
  },
) {
  const encodedSlug = encodeURIComponent(slug);
  const search = new URLSearchParams({ token, delivery_id: deliveryId }).toString();
  return apiFetch(`/public/schools/${encodedSlug}/delivery/current/?${search}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function getPublicMealService(slug: string, token: string, serviceDate?: string) {
  const encodedSlug = encodeURIComponent(slug);
  const params = new URLSearchParams({ token });
  if (serviceDate) params.set('date', serviceDate);
  return apiFetch(`/public/schools/${encodedSlug}/meal-service/?${params.toString()}`, { skipAuth: true });
}

export async function submitPublicMealService(
  slug: string,
  token: string,
  payload: {
    service_date: string;
    items: Array<{ meal_type: string; served_count: number }>;
  },
) {
  const encodedSlug = encodeURIComponent(slug);
  const params = new URLSearchParams({ token });
  return apiFetch(`/public/schools/${encodedSlug}/meal-service/?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}


export async function getPublicSupplies(slug: string, token: string) {
  const encodedSlug = encodeURIComponent(slug);
  const search = new URLSearchParams({ token }).toString();
  return apiFetch(`/public/schools/${encodedSlug}/consumption/?${search}`, { skipAuth: true });
}

export async function submitPublicConsumption(
  slug: string,
  token: string,
  payload: { items: Array<{ supply: string; quantity: number; movement_date: string; note?: string }> },
) {
  const encodedSlug = encodeURIComponent(slug);
  const search = new URLSearchParams({ token }).toString();
  return apiFetch(`/public/schools/${encodedSlug}/consumption/?${search}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function getDashboard() {
  return apiFetch('/api/dashboard/');
}

export async function getAuditLogs(params?: {
  user_id?: string;
  action_type?: 'CREATE' | 'UPDATE' | 'DELETE';
  method?: string;
  path?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/audit-logs/${search ? `?${search}` : ''}`);
}

export async function getNutritionists(params?: {
  q?: string;
  is_active?: boolean;
}) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/users/nutritionists/${search ? `?${search}` : ''}`);
}

export async function createNutritionist(payload: {
  name?: string;
  crn?: string;
  function_role?: string;
  email?: string;
  password?: string;
}) {
  return apiFetch('/api/users/nutritionists/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateNutritionist(id: string, payload: Partial<{
  name: string;
  email: string;
  crn: string;
  function_role: string;
  password: string;
  is_active: boolean;
}>) {
  return apiFetch(`/api/users/nutritionists/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deactivateNutritionist(id: string) {
  return apiFetch(`/api/users/nutritionists/${id}/deactivate/`, {
    method: 'POST',
  });
}

export async function getDashboardSeries() {
  return apiFetch('/api/dashboard/series/');
}

export async function clearDashboardConsumptionSeries() {
  return apiFetch<{ detail: string; deleted_count: number }>('/api/dashboard/series/clear-consumption/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function exportStockCsv() {
  openAuthenticatedUrl('/api/exports/stock/');
}

export function exportStockPdf() {
  openAuthenticatedUrl('/api/exports/stock/pdf/');
}

export function exportStockXlsx() {
  openAuthenticatedUrl('/api/exports/stock/xlsx/');
}

export function exportMenusCsv() {
  openAuthenticatedUrl('/api/exports/menus/');
}


export function exportMenuPdf(schoolId: string, weekStart: string) {
  openAuthenticatedUrl(`/api/exports/menus/pdf/?school=${schoolId}&week_start=${weekStart}`);
}

export function exportPublicMenuPdf(slug: string, weekStart: string, token?: string) {
  const encodedSlug = encodeURIComponent(slug);
  const params = new URLSearchParams({ week_start: weekStart });
  if (token) params.append('token', token);
  const url = `${API_BASE}/public/schools/${encodedSlug}/menu/pdf/?${params.toString()}`;
  window.open(url, '_blank');
}

export function exportDeliveriesPdf(params?: { school?: string; status?: string; date_from?: string; date_to?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  openAuthenticatedUrl(`/api/exports/deliveries/pdf/${search ? `?${search}` : ''}`);
}

export function exportDeliveriesXlsx(params?: { school?: string; status?: string; date_from?: string; date_to?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  openAuthenticatedUrl(`/api/exports/deliveries/xlsx/${search ? `?${search}` : ''}`);
}

export function exportConsumptionPdf(params?: { supply?: string; date_from?: string; date_to?: string; school?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  openAuthenticatedUrl(`/api/exports/consumption/pdf/${search ? `?${search}` : ''}`);
}

export function exportConsumptionXlsx(params?: { supply?: string; date_from?: string; date_to?: string; school?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  openAuthenticatedUrl(`/api/exports/consumption/xlsx/${search ? `?${search}` : ''}`);
}

export function exportSupplierReceiptsPdf(params?: {
  supplier?: string;
  school?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  openAuthenticatedUrl(`/api/exports/supplier-receipts/pdf/${search ? `?${search}` : ''}`);
}

// Helper to open URLs with authentication token as query parameter
function openAuthenticatedUrl(url: string) {
  const token = tokenStore.getAccess();
  const separator = url.includes('?') ? '&' : '?';
  const authenticatedUrl = token ? `${url}${separator}token=${token}` : url;
  window.open(authenticatedUrl, '_blank');
}

// ============ NOTIFICATIONS ============
export async function getNotifications() {
  return apiFetch('/api/notifications/');
}

export async function getUnreadNotificationsCount() {
  return apiFetch('/api/notifications/unread_count/');
}

export async function markNotificationAsRead(id: string) {
  return apiFetch(`/api/notifications/${id}/mark_read/`, { method: 'POST' });
}

export async function markAllNotificationsAsRead() {
  return apiFetch('/api/notifications/mark_all_read/', { method: 'POST' });
}

// ============ SCHOOL STOCK CONFIG ============
export async function getSchoolStockConfig(schoolId: string) {
  return apiFetch(`/api/school-stock-config/?school=${schoolId}`);
}

export async function updateSchoolStockLimit(balanceId: string, minStock: number) {
  return apiFetch(`/api/school-stock-config/${balanceId}/update_limit/`, {
    method: 'PATCH',
    body: JSON.stringify({ min_stock: minStock }),
  });
}

export async function bulkUpdateSchoolStockLimits(items: Array<{ id: string; min_stock: number }>) {
  return apiFetch('/api/school-stock-config/bulk_update_limits/', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}
