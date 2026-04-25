import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpJson } from '@/api/http';

const fetchMock = vi.fn();

describe('httpJson', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serializes plain object bodies as JSON and applies auth headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const result = await httpJson<{ success: boolean }>('/demo', {
      method: 'POST',
      token: 'token-a',
      body: { name: 'class-a' },
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Headers;

    expect(url).toBe('/api/demo');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toBe(JSON.stringify({ name: 'class-a' }));
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token-a');
  });

  it('keeps FormData bodies unmodified without forcing JSON content type', async () => {
    const formData = new FormData();
    formData.set('file', 'csv-text');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await httpJson('/upload', {
      method: 'POST',
      body: formData,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Headers;

    expect(requestInit.body).toBe(formData);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('throws HttpError with parsed JSON error payloads', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );

    await expect(httpJson('/forbidden')).rejects.toMatchObject({
      message: 'Forbidden',
      status: 403,
      payload: { message: 'Forbidden' },
    });
  });
});
