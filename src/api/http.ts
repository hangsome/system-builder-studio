const rawBase = String(import.meta.env.VITE_API_BASE_URL || '/api').trim();
const API_BASE_URL = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

function joinUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function tryParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export type HttpJsonInit = Omit<RequestInit, 'body'> & {
  token?: string;
  body?: unknown;
};

export async function httpJson<T>(
  path: string,
  init: HttpJsonInit = {}
) {
  const { token, headers, body, ...rest } = init;
  const nextHeaders = new Headers(headers || {});
  if (!nextHeaders.has('Content-Type') && !(body instanceof FormData)) {
    nextHeaders.set('Content-Type', 'application/json');
  }
  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  const shouldSerializeBody =
    body !== undefined &&
    body !== null &&
    typeof body !== 'string' &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer);

  const response = await fetch(joinUrl(path), {
    ...rest,
    headers: nextHeaders,
    body: shouldSerializeBody ? JSON.stringify(body) : (body as BodyInit | null | undefined),
  });

  const rawText = await response.text();
  const jsonPayload = tryParseJson(rawText);
  if (!response.ok) {
    const message =
      (jsonPayload as { error?: string; message?: string } | null)?.error ||
      (jsonPayload as { error?: string; message?: string } | null)?.message ||
      `HTTP ${response.status}`;
    throw new HttpError(message, response.status, jsonPayload || rawText);
  }

  return (jsonPayload ?? ({} as T)) as T;
}

