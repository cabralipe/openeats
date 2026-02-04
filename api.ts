const API_BASE = import.meta.env.VITE_API_BASE || '';

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

    if (response.status === 401 && !options.skipAuth) {
      const refreshedToken = options._retry ? null : await tryRefreshAccessToken();
      if (refreshedToken) {
        return apiFetch<T>(path, { ...options, _retry: true });
      }
      tokenStore.clear();
      notifyAuthExpired();
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    throw new Error(message || 'Erro na requisicao');
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

export async function getSchools(params?: { q?: string; city?: string; address?: string; is_active?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/schools/${search ? `?${search}` : ''}`);
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

export async function getStock(params?: { q?: string; category?: string; low_stock?: boolean }) {
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

export async function createSupply(payload: {
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  is_active?: boolean;
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
}>) {
  return apiFetch(`/api/supplies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
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

export async function getDeliveries(params?: { school?: string; status?: string; conference_enabled?: boolean }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
    : undefined;
  const search = cleanParams ? new URLSearchParams(cleanParams as Record<string, string>).toString() : '';
  return apiFetch(`/api/deliveries/${search ? `?${search}` : ''}`);
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

export async function sendDelivery(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/send/`, {
    method: 'POST',
  });
}

export async function getDeliveryConferenceLink(deliveryId: string) {
  return apiFetch(`/api/deliveries/${deliveryId}/conference_link/`);
}

export async function getMenus(params: { school?: string; week_start?: string; week_end?: string; date_from?: string; date_to?: string; status?: string }) {
  const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  const search = new URLSearchParams(cleanParams as Record<string, string>).toString();
  return apiFetch(`/api/menus/${search ? `?${search}` : ''}`);
}

export async function createMenu(payload: {
  school: string;
  week_start: string;
  week_end: string;
  status?: string;
  notes?: string;
}) {
  return apiFetch('/api/menus/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMenu(id: string, payload: Partial<{
  week_start: string;
  week_end: string;
  status: string;
  notes: string;
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
}>) {
  return apiFetch(`/api/menus/${menuId}/items/bulk/`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function publishMenu(menuId: string) {
  return apiFetch(`/api/menus/${menuId}/publish/`, {
    method: 'POST',
  });
}

export async function getPublicMenuCurrent(slug: string, token: string) {
  return apiFetch(`/public/schools/${slug}/menu/current/?token=${token}`, { skipAuth: true });
}

export async function getPublicDeliveryCurrent(slug: string, token: string, deliveryId: string) {
  const search = new URLSearchParams({ token, delivery_id: deliveryId }).toString();
  return apiFetch(`/public/schools/${slug}/delivery/current/?${search}`, { skipAuth: true });
}

export async function submitPublicDeliveryConference(
  slug: string,
  token: string,
  deliveryId: string,
  payload: { items: Array<{ item_id: string; received_quantity: number; note?: string }> },
) {
  const search = new URLSearchParams({ token, delivery_id: deliveryId }).toString();
  return apiFetch(`/public/schools/${slug}/delivery/current/?${search}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function getDashboard() {
  return apiFetch('/api/dashboard/');
}

export async function getDashboardSeries() {
  return apiFetch('/api/dashboard/series/');
}

export function exportStockCsv() {
  window.open('/api/exports/stock/', '_blank');
}

export function exportMenusCsv() {
  window.open('/api/exports/menus/', '_blank');
}

export function exportMenuPdf(schoolId: string, weekStart: string) {
  window.open(`/api/exports/menus/pdf/?school=${schoolId}&week_start=${weekStart}`, '_blank');
}
