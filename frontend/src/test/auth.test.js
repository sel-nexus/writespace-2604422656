/** Exercise real browser-local account/session persistence and its failure branches. */
import { describe, expect, it, vi } from 'vitest';
import {
  clearSession, DEFAULT_ADMIN, getAccounts, getSession, isValidAccount, login,
  register, roleHome, SESSION_KEY, sessionFor, setSession, validateSession,
} from '../utils/auth.js';
import { getUsers, saveUsers } from '../utils/storage.js';

const input = { displayName: 'Mira', username: 'mira', password: 'demo-only', confirmPassword: 'demo-only' };

describe('local demo identity', () => {
  it('always includes the exact permanent administrator and checks its credentials first', () => {
    expect(DEFAULT_ADMIN).toEqual({ id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin' });
    expect(getAccounts()).toEqual([DEFAULT_ADMIN]);
    const session = login('admin', 'admin');
    expect(session).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
    expect(getSession()).toEqual(session);
    expect(getUsers()).toEqual([]);
    expect(roleHome(session)).toBe('/admin');
  });

  it('registers only a user with UUID, ISO timestamp and a password-free persisted session', async () => {
    const session = register({ ...input, role: 'admin' });
    const [account] = getUsers();
    expect(account).toMatchObject({ displayName: 'Mira', username: 'mira', password: 'demo-only', role: 'user' });
    expect(account.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(session).toEqual(sessionFor(account));
    expect(session).not.toHaveProperty('password');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(session);
    const freshModule = await import('../utils/auth.js');
    expect(freshModule.getSession()).toEqual(session);
    expect(roleHome(session)).toBe('/blogs');
    clearSession();
    expect(getSession()).toBeNull();
    expect(login('mira', 'demo-only')).toEqual(session);
  });

  it.each(['displayName', 'username', 'password', 'confirmPassword'])('rejects a missing registration %s', key => {
    try {
      register({ ...input, [key]: '   ' });
      throw new Error('Registration unexpectedly succeeded');
    } catch (error) {
      expect(error.fields[key]).toMatch(/required/);
    }
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rejects absent registration data and mismatching passwords', () => {
    expect(() => register()).toThrow(/highlighted fields/);
    expect(() => register(null)).toThrow(/highlighted fields/);
    try {
      register({ ...input, confirmPassword: 'different' });
      throw new Error('Registration unexpectedly succeeded');
    } catch (error) {
      expect(error.fields.confirmPassword).toBe('Passwords must match.');
    }
    expect(getUsers()).toEqual([]);
  });

  it('reserves admin and existing usernames, including names trimmed by registration', () => {
    expect(() => register({ ...input, username: ' admin ' })).toThrow(/highlighted fields/);
    const first = register(input);
    expect(() => register({ ...input, username: ' mira ' })).toThrow(/highlighted fields/);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toEqual(first);
    const second = register({ ...input, username: 'another' });
    expect(second.userId).not.toBe(first.userId);
  });

  it.each([['', ''], [null, 'demo'], ['mira', ''], ['admin', 'wrong'], ['missing', 'demo']])(
    'rejects missing or invalid credentials %s / %s', (username, password) => {
      expect(() => login(username, password)).toThrow();
      expect(getSession()).toBeNull();
    },
  );

  it('uses the exact invalid-credential message and does not accept malformed account roles', () => {
    const session = register(input);
    clearSession();
    expect(() => login('mira', 'wrong')).toThrow('Invalid username or password.');
    const [account] = getUsers();
    saveUsers([{ ...account, role: 'Admin' }]);
    expect(() => login('mira', 'demo-only')).toThrow('Invalid username or password.');
    expect(validateSession(session)).toBeNull();
    expect(isValidAccount({ ...account, createdAt: 'invalid' })).toBe(false);
    expect(isValidAccount(null)).toBe(false);
  });

  it.each([null, [], {}, 'bad', { userId: 'admin', role: 'ADMIN' }, {
    userId: 'admin', username: 'admin', displayName: 'Imposter', role: 'admin',
  }])('fails closed for malformed session %j', value => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    expect(getSession()).toBeNull();
    expect(() => setSession(value)).toThrow(/invalid/);
  });

  it('fails closed on corrupt JSON, throwing reads, removed users and modified identity', () => {
    localStorage.setItem(SESSION_KEY, '{broken');
    expect(getSession()).toBeNull();
    const session = register(input);
    const [account] = getUsers();
    saveUsers([{ ...account, displayName: 'Changed' }]);
    expect(getSession()).toBeNull();
    saveUsers([]);
    expect(validateSession(session)).toBeNull();
    expect(getSession()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => getSession()).not.toThrow();
    expect(getSession()).toBeNull();
  });

  it('rejects session role escalation against the stored ordinary account', () => {
    const session = register(input);
    expect(() => setSession({ ...session, role: 'admin' })).toThrow(/invalid/);
    expect(getSession()).toEqual(session);
  });

  it('surfaces account and session write failures without reporting success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => register(input)).toThrow(/Browser storage/);
    expect(() => login('admin', 'admin')).toThrow(/session could not be saved/);
    expect(() => setSession(sessionFor(DEFAULT_ADMIN))).toThrow(/session could not be saved/);
    expect(getSession()).toBeNull();
  });

  it('keeps a saved account recoverable when only session persistence fails', () => {
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === SESSION_KEY) throw new Error('denied');
      original.call(this, key, value);
    });
    expect(() => register(input)).toThrow(/session could not be saved/);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    spy.mockRestore();
    expect(login('mira', 'demo-only').username).toBe('mira');
  });

  it('shows a friendly error if secure UUID generation is unavailable', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    expect(() => register(input)).toThrow(/secure UUID support/);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rejects malformed accounts while keeping the default admin usable', () => {
    saveUsers([
      { id: 'admin', username: 'admin', password: 'other', displayName: 'Fake', role: 'admin' },
      { id: 'bad', username: 'bad', password: 'demo', displayName: 'Bad', role: 'superuser', createdAt: '2026-01-01' },
    ]);
    expect(getAccounts()).toEqual([DEFAULT_ADMIN]);
    expect(() => login('admin', 'other')).toThrow('Invalid username or password.');
    expect(login('admin', 'admin').displayName).toBe('Admin');
  });

  it('reports logout removal failure, preserves identity, then removes it idempotently', () => {
    const session = login('admin', 'admin');
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => clearSession()).toThrow(/Could not log out/);
    expect(getSession()).toEqual(session);
    spy.mockRestore();
    clearSession();
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
