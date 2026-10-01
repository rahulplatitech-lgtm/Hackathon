import { simulationStore } from './simulationStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  const isHttps = isBrowser && window.location.protocol === 'https:';
  const isLocalHttp = BASE_URL.startsWith('http://localhost') || BASE_URL.startsWith('http://127.0.0.1');

  // In production HTTPS (e.g. Vercel) where backend is pointing to localhost HTTP,
  // browsers strictly block mixed-content fetch with "TypeError: Load failed".
  // Fall back to client simulation immediately without throwing network errors.
  if (isHttps && isLocalHttp) {
    return simulationStore.handleRequest<T>(path, options);
  }

  try {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    
    if (!res.ok) {
      // If server is not ready or route 404s, fall back to simulation store
      if (res.status === 404 || res.status >= 500) {
        return simulationStore.handleRequest<T>(path, options);
      }
      const body = await res.text().catch(() => 'Unknown error');
      throw new ApiError(res.status, body);
    }
    return res.json();
  } catch (err) {
    // If backend is unreachable (offline, CORS, mixed content, or connection refused)
    return simulationStore.handleRequest<T>(path, options);
  }
}

export async function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export async function postForm<T>(path: string, formData: FormData): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  const isHttps = isBrowser && window.location.protocol === 'https:';
  const isLocalHttp = BASE_URL.startsWith('http://localhost') || BASE_URL.startsWith('http://127.0.0.1');

  if (isHttps && isLocalHttp) {
    return simulationStore.handleRequest<T>(path, { method: 'POST' });
  }

  try {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) {
      return simulationStore.handleRequest<T>(path, { method: 'POST' });
    }
    return res.json();
  } catch {
    return simulationStore.handleRequest<T>(path, { method: 'POST' });
  }
}

export { ApiError, BASE_URL };
