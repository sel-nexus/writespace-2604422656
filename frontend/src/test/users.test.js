/** Specify account authorization, validation, persistence and historical-data boundaries. */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN, getAccounts, sessionFor, setSession } from '../utils/auth.js';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage.js';
import { createUser, deleteUser, getStats } from '../utils/users.js';

const admin = sessionFor(DEFAULT_ADMIN);
const valid = { displayName: 'Mira', username: 'mira', password: 'demo-only', role: 'user' };

/** Seed a usable non-default account for authorization cases. */
function seed(role = 'user') {
  const account = { ...valid, id: 'mira-id', role, createdAt: '2026-03-04T12:00:00.000Z' };
  saveUsers([account]);
  return account;
}

describe('createUser', () => {
  it.each(['user', 'admin'])('persists a %s with UUID/ISO metadata and leaves the admin session unchanged', role => {
    setSession(admin);
    const account = createUser({ ...valid, displayName: ' Mira ', username: ' mira ', role });
    expect(account).toMatchObject({ ...valid, role });
    expect(account.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(getUsers()).toEqual([account]);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(admin);
  });

  for (const key of ['displayName', 'username', 'password', 'role']) {
    for (const value of [undefined, null, '', '   ', 1, {}, []]) {
      it(`rejects ${key} value ${JSON.stringify(value)} alone without writing`, () => {
        expect(() => createUser({ ...valid, [key]: value }, admin)).toThrow('highlighted fields');
        try { createUser({ ...valid, [key]: value }, admin); }
        catch (error) { expect(Object.keys(error.fields)).toEqual([key]); }
        expect(getUsers()).toEqual([]);
      });
    }
    it(`rejects missing ${key} alone`, () => {
      const input = { ...valid };
      delete input[key];
      try { createUser(input, admin); throw new Error('Expected rejection'); }
      catch (error) { expect(Object.keys(error.fields)).toEqual([key]); }
      expect(getUsers()).toEqual([]);
    });
  }

  it.each([undefined, null, [], 5, 'text'])('rejects malformed entire input %j', input => {
    expect(() => createUser(input, admin)).toThrow('highlighted fields');
    expect(getUsers()).toEqual([]);
  });
  it.each(['Admin', 'writer', ' USER '])('rejects unsupported role %s', role => {
    expect(() => createUser({ ...valid, role }, admin)).toThrow('highlighted fields');
    expect(getUsers()).toEqual([]);
  });
  it.each(['admin', ' admin ', 'mira', ' mira '])('rejects duplicate username %s including permanent admin', username => {
    const original = seed();
    expect(() => createUser({ ...valid, username }, admin)).toThrow('highlighted fields');
    expect(getUsers()).toEqual([original]);
  });
  it('reserves usernames even when another stored record is malformed', () => {
    saveUsers([{ username: 'mira' }]);
    expect(() => createUser(valid, admin)).toThrow('highlighted fields');
    expect(getUsers()).toEqual([{ username: 'mira' }]);
  });
  it('reports UUID generation failure without creating anything', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => createUser(valid, admin)).toThrow('secure UUID support');
    expect(getUsers()).toEqual([]);
  });
  it('reports storage failure and preserves existing accounts', () => {
    const original = seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => createUser({ ...valid, username: 'new' }, admin)).toThrow('Nothing was saved');
    expect(getUsers()).toEqual([original]);
  });
});

describe('administrator authorization on every service', () => {
  it.each(['userId', 'username', 'displayName', 'role'])('rejects an identity missing %s on every service', key => {
    const identity = { ...admin };
    delete identity[key];
    expect(() => createUser(valid, identity)).toThrow('Administrator access');
    expect(() => deleteUser('admin', identity)).toThrow('Administrator access');
    expect(() => getStats(identity)).toThrow('Administrator access');
  });
  it('allows a currently stored non-default administrator to create and delete another account', () => {
    const current = seed('admin');
    const identity = sessionFor(current);
    const created = createUser({ ...valid, username: 'new-writer' }, identity);
    expect(getStats(identity)).toEqual({ posts: 0, accounts: 3, admins: 2, writers: 1 });
    deleteUser(created.id, identity);
    expect(getUsers()).toEqual([current]);
  });
  it.each([null, {}, [], { ...admin, role: 'Admin' }, { ...admin, displayName: 'Forged' }, { ...admin, userId: 'missing' }])(
    'fails closed for identity %j', identity => {
      expect(() => createUser(valid, identity)).toThrow('Administrator access');
      expect(() => deleteUser('admin', identity)).toThrow('Administrator access');
      expect(() => getStats(identity)).toThrow('Administrator access');
      expect(getUsers()).toEqual([]);
    },
  );
  it('denies ordinary and forged elevated writer sessions', () => {
    const writer = seed();
    for (const identity of [sessionFor(writer), { ...sessionFor(writer), role: 'admin' }]) {
      expect(() => createUser(valid, identity)).toThrow('Administrator access');
      expect(() => deleteUser(writer.id, identity)).toThrow('Administrator access');
      expect(() => getStats(identity)).toThrow('Administrator access');
    }
    expect(getUsers()).toEqual([writer]);
  });
  it('denies a removed administrator despite its previously valid session', () => {
    const identity = sessionFor(seed('admin'));
    saveUsers([]);
    expect(() => createUser(valid, identity)).toThrow('Administrator access');
    expect(() => deleteUser('admin', identity)).toThrow('Administrator access');
    expect(() => getStats(identity)).toThrow('Administrator access');
  });
  it('defaults to guest without a persisted session', () => {
    expect(() => createUser(valid)).toThrow('Administrator access');
    expect(() => deleteUser('admin')).toThrow('Administrator access');
    expect(() => getStats()).toThrow('Administrator access');
  });
});

describe('deleteUser and computed totals', () => {
  it('never deletes the permanent administrator', () => {
    expect(() => deleteUser('admin', admin)).toThrow('Default admin cannot be deleted.');
    expect(getAccounts()).toEqual([DEFAULT_ADMIN]);
  });
  it('never deletes the current non-default administrator', () => {
    const account = seed('admin');
    expect(() => deleteUser(account.id, sessionFor(account))).toThrow('own account');
    expect(getUsers()).toEqual([account]);
  });
  it.each(['missing', '', ' ', undefined, null, 4, {}, []])('rejects missing/invalid target %j', id => {
    const original = seed();
    expect(() => deleteUser(id, admin)).toThrow('User not found');
    expect(getUsers()).toEqual([original]);
  });
  it.each(['user', 'admin'])('deletes another %s but retains their original posts and authorName', role => {
    const original = seed(role);
    const post = {
      id: 'post', title: 'Historical', content: 'Original', authorId: original.id, authorName: original.displayName,
      createdAt: '2026-03-04T12:00:00.000Z',
    };
    savePosts([post]);
    setSession(admin);
    deleteUser(original.id);
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual([post]);
    expect(getStats()).toEqual({ posts: 1, accounts: 1, admins: 1, writers: 0 });
  });
  it('reports failed deletion without removing the account', () => {
    const original = seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => deleteUser(original.id, admin)).toThrow('Nothing was saved');
    expect(getUsers()).toEqual([original]);
  });
  it('requeries storage after creation, post changes and deletion rather than caching counts', () => {
    expect(getStats(admin)).toEqual({ posts: 0, accounts: 1, admins: 1, writers: 0 });
    const writer = createUser(valid, admin);
    const otherAdmin = createUser({ ...valid, username: 'editor', role: 'admin' }, admin);
    savePosts([{ id: 'p', title: 'T', content: 'C', authorId: writer.id, authorName: 'Mira', createdAt: '2026-03-04' }]);
    expect(getStats(admin)).toEqual({ posts: 1, accounts: 3, admins: 2, writers: 1 });
    deleteUser(otherAdmin.id, admin);
    savePosts([]);
    expect(getStats(admin)).toEqual({ posts: 0, accounts: 2, admins: 1, writers: 1 });
  });
  it('filters malformed data and safely handles corrupt or unreadable storage', () => {
    saveUsers([{ id: 'bad' }]);
    savePosts([{ id: 'bad' }]);
    expect(getStats(admin)).toEqual({ posts: 0, accounts: 1, admins: 1, writers: 0 });
    localStorage.setItem('writespace_users', '{bad');
    localStorage.setItem('writespace_posts', '{bad');
    expect(getStats(admin)).toEqual({ posts: 0, accounts: 1, admins: 1, writers: 0 });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getStats(admin)).toEqual({ posts: 0, accounts: 1, admins: 1, writers: 0 });
  });
});
