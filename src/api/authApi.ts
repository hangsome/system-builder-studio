import { httpJson } from '@/api/http';
import { AuthUser } from '@/types/edu';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
}

export async function loginApi(username: string, password: string) {
  return httpJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function meApi(token: string) {
  return httpJson<MeResponse>('/auth/me', {
    method: 'GET',
    token,
  });
}

export async function changePasswordApi(token: string, oldPassword: string, newPassword: string) {
  return httpJson<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    token,
    body: { oldPassword, newPassword },
  });
}

