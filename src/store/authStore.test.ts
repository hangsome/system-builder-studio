import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';

function makeJwt(exp: number) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${header}.${payload}.signature`;
}

describe('authStore', () => {
  beforeEach(() => {
    localStorage.removeItem('teaching-auth');
    useAuthStore.getState().clearSession();
  });

  it('keeps session valid before exp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T10:00:00.000Z'));
    const exp = Math.floor(Date.now() / 1000) + 3600;

    useAuthStore.getState().setSession(makeJwt(exp), {
      id: 1,
      username: 'teacher_a',
      role: 'teacher',
      displayName: 'Teacher A',
    });

    expect(useAuthStore.getState().isSessionValid()).toBe(true);
    vi.useRealTimers();
  });

  it('invalidates expired session without side effects', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T10:00:00.000Z'));
    const exp = Math.floor(Date.now() / 1000) - 1;

    useAuthStore.getState().setSession(makeJwt(exp), {
      id: 2,
      username: 'student_a',
      role: 'student',
      displayName: 'Student A',
    });

    expect(useAuthStore.getState().isSessionValid()).toBe(false);
    expect(useAuthStore.getState().token).toBeTruthy();
    vi.useRealTimers();
  });
});
