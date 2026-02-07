/**
 * 管理员 API 调用封装
 */

import { getApiConfig } from './api';

const STORAGE_KEY = 'simu_admin_token';

export interface AdminLicense {
  license_key: string;
  license_type: 'personal' | 'teacher';
  status: 'unused' | 'activated' | 'revoked';
  device_count?: number;
  activated_at?: string | null;
  created_at?: string;
  notes?: string | null;
}

export interface AdminLicenseListResponse {
  licenses: AdminLicense[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminGenerateResponse {
  success: boolean;
  licenses: string[];
  count: number;
}

export function setAdminToken(token: string) {
  if (!token) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getAdminToken();
  if (!token) {
    throw new Error('请先设置管理员 Token');
  }
  
  const { baseUrl } = getApiConfig();
  const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const url = normalizedBase ? `${normalizedBase}${path}` : path;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `请求失败: ${response.status}`);
  }
  
  return response.json();
}

export async function generateLicenses(params: { count: number; type: 'personal' | 'teacher'; notes?: string }) {
  return adminFetch('/api/admin/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  }) as Promise<AdminGenerateResponse>;
}

export async function fetchLicenses(params: { status?: string; type?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));
  
  return adminFetch(`/api/admin/licenses?${query.toString()}`) as Promise<AdminLicenseListResponse>;
}

export async function revokeLicense(licenseKey: string) {
  return adminFetch('/api/admin/revoke', {
    method: 'POST',
    body: JSON.stringify({ licenseKey }),
  }) as Promise<{ success: boolean; message?: string }>;
}
