const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${new URL(API_URL).origin}${path}`;
  return '';
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${API_URL}${endpoint}`, { ...options, headers, credentials: 'include' });
      if (!retry.ok) {
        const json: ApiResponse<T> = await retry.json();
        if (retry.status === 401) clearSession();
        throw new Error(json.error || 'Request failed');
      }
      return retry.json() as Promise<ApiResponse<T>>;
    }
    clearSession();
  }

  const json: ApiResponse<T> = await res.json();

  if (!res.ok) {
    // Only hard-redirect on a 401 when a session existed but has expired.
    // A failed login attempt (no valid token yet) must NOT reload the page,
    // otherwise the error toast never gets a chance to render.
    // "user" cached in localStorage means a session existed at some point,
    // even if it has now expired — treat that as expired.
    const hadSession = typeof window !== 'undefined' && Boolean(localStorage.getItem('user'));
    if (res.status === 401 && hadSession) {
      clearSession();
    }
    throw new Error(json.error || 'Request failed');
  }

  return json;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  upload: async <T>(endpoint: string, file: File, extra?: Record<string, string>): Promise<ApiResponse<T>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (extra) Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const json: ApiResponse<T> = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    return json;
  },
  download: async (endpoint: string, filename: string): Promise<void> => {
    const res = await fetch(`${API_URL}${endpoint}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
