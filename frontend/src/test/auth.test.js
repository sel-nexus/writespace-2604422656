/** Exercise real browser-local account/session persistence and its failure branches. */
import { describe, expect, it, vi } from 'vitest';
import {
  clearSession, DEFAULT_ADMIN, getAccounts, getSession, isValidAccount, login,
  register, roleHome, SESSION_KEY, sessionFor, setSession, validateSession,
} from '../utils/auth.js';
import { getUsers, saveUsers } from '../utils/storage.js';

const input = { displayName: 'Mira', username: 'mira', password: 'demo-only', confirmPassword: 'demo-only' };
const registrationFields = [
  ['displayName', 'Display name'], ['username', 'Username'],
  ['password', 'Password'], ['confirmPassword', 'Confirm password'],
];
const invalidTypes = [['null', null], ['number', 42], ['boolean', true], ['object', {}], ['array', []]];

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

  it.each(registrationFields)('rejects independently omitted registration %s', (key, label) => {
    const canonical = login('admin', 'admin');
    const stored = localStorage.getItem(SESSION_KEY);
    const candidate = { ...input };
    delete candidate[key];
    expect(() => register(candidate)).toThrow(expect.objectContaining({
      fields: { [key]: `${label} is required.` },
    }));
    expect(getUsers()).toEqual([]);
    expect(localStorage.getItem(SESSION_KEY)).toBe(stored);
    expect(getSession()).toEqual(canonical);
  });

  it.each(registrationFields.flatMap(([key, label]) => invalidTypes.map(([type, value]) =>
    [key, label, type, value])))('rejects registration %s (%s) with %s type independently', (key, label, type, value) => {
    const canonical = login('admin', 'admin');
    const stored = localStorage.getItem(SESSION_KEY);
    expect(() => register({ ...input, [key]: value })).toThrow(expect.objectContaining({
      fields: { [key]: `${label} is required.` },
    }));
    expect(getUsers()).toEqual([]);
    expect(localStorage.getItem(SESSION_KEY)).toBe(stored);
    expect(getSession()).toEqual(canonical);
  });

  it('roundtrips large displayName, username and password without truncation or an invented maximum', () => {
    const displayName = 'Writer '.repeat(2048).trim();
    const username = 'writer'.repeat(2048);
    const password = 'demo-only '.repeat(2048);
    const session = register({ displayName, username, password, confirmPassword: password });
    const [account] = getUsers();
    expect(account).toMatchObject({ displayName, username, password, role: 'user' });
    expect(session).toEqual({ userId: account.id, displayName, username, role: 'user' });
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(session);
    expect(getSession()).toEqual(session);
    clearSession();
    expect(login(username, password)).toEqual(session);
    expect(getSession()).toEqual(session);
    expect(getUsers()).toEqual([account]);
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

  it.each(['username', 'password'].flatMap(key => invalidTypes.map(([type, value]) =>
    [key, type, value])))('rejects login %s with %s type while the other credential is valid', (key, type, value) => {
    const canonical = login('admin', 'admin');
    const stored = localStorage.getItem(SESSION_KEY);
    const credentials = { username: 'admin', password: 'admin', [key]: value };
    expect(() => login(credentials.username, credentials.password)).toThrow(expect.objectContaining({
      fields: { [key]: `${key === 'username' ? 'Username' : 'Password'} is required.` },
    }));
    expect(localStorage.getItem(SESSION_KEY)).toBe(stored);
    expect(getSession()).toEqual(canonical);
    expect(getUsers()).toEqual([]);
  });

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

// Complete unsupported-role identities reach the role allowlist, not the missing-field branch.
describe.each(['validateSession', 'getSession', 'setSession'])('%s session validation branches', method => {
  it('accepts a complete canonical identity and persists only canonical fields', () => {
    const canonical = login('admin', 'admin');
    const candidate = { ...canonical, password: 'never persist this', extra: true };
    if (method === 'validateSession') expect(validateSession(candidate)).toEqual(canonical);
    if (method === 'getSession') expect(getSession()).toEqual(canonical);
    if (method === 'setSession') expect(setSession(candidate)).toEqual(canonical);
    expect(localStorage.getItem(SESSION_KEY)).toBe(JSON.stringify(canonical));
  });

  const rejected = [
    ...[null, [], 'bad', 42, true].map(value => ['invalid shape', value]),
    ...['userId', 'username', 'displayName', 'role'].map(key => {
      const value = sessionFor(DEFAULT_ADMIN);
      delete value[key];
      return [`missing ${key}`, value];
    }),
    ...['ADMIN', 'superuser'].map(role => [`unsupported complete role ${role}`, { ...sessionFor(DEFAULT_ADMIN), role }]),
    ['absent account', { userId: 'missing', username: 'missing', displayName: 'Missing', role: 'user' }],
    ['username mismatch', { ...sessionFor(DEFAULT_ADMIN), username: 'imposter' }],
    ['displayName mismatch', { ...sessionFor(DEFAULT_ADMIN), displayName: 'Imposter' }],
    ['allowed but mismatching role', { ...sessionFor(DEFAULT_ADMIN), role: 'user' }],
  ];

  it.each(rejected)('rejects %s without overwriting storage', (reason, candidate) => {
    const canonical = login('admin', 'admin');
    const stored = localStorage.getItem(SESSION_KEY);
    if (method === 'validateSession') expect(validateSession(candidate)).toBeNull();
    if (method === 'getSession') {
      const invalidStored = JSON.stringify(candidate);
      localStorage.setItem(SESSION_KEY, invalidStored);
      expect(getSession()).toBeNull();
      expect(localStorage.getItem(SESSION_KEY)).toBe(invalidStored);
      // Restore the fixture explicitly; getSession must never repair or remove rejected data.
      localStorage.setItem(SESSION_KEY, stored);
    }
    if (method === 'setSession') expect(() => setSession(candidate)).toThrow('This account session is invalid. Please log in again.');
    expect(localStorage.getItem(SESSION_KEY)).toBe(stored);
    expect(getSession()).toEqual(canonical);
    expect(getUsers()).toEqual([]);
  });
});
