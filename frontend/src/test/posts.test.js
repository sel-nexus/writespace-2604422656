/** Exercise real localStorage CRUD, validation, authorization and persistence failures. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, register, sessionFor, DEFAULT_ADMIN } from '../utils/auth.js';
import { getPosts, savePosts, saveUsers } from '../utils/storage.js';
import { sortedPosts, getPost, canManage, createPost, updatePost, deletePost, formatPostDate } from '../utils/posts.js';

let owner;
const admin = sessionFor(DEFAULT_ADMIN);
const input = { title: '  A title  ', content: 'First line\n\n<script>alert(1)</script>\n ' };
const other = { userId: 'other', username: 'other', displayName: 'Other', role: 'user' };

beforeEach(() => {
  owner = register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
  const users = JSON.parse(localStorage.getItem('writespace_users'));
  saveUsers([...users, {
    id: 'other', username: 'other', displayName: 'Other', password: 'demo', role: 'user', createdAt: new Date().toISOString(),
  }]);
});

describe('post reading and metadata', () => {
  it('creates UUID/ISO metadata from canonical session, ignores supplied metadata and rereads saved plaintext', () => {
    const post = createPost({ ...input, id: 'forged', authorId: 'forged', authorName: 'forged', createdAt: 'forged' });
    expect(post.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(post.createdAt).toISOString()).toBe(post.createdAt);
    expect(post).toMatchObject({ title: 'A title', content: input.content, authorId: owner.userId, authorName: 'Writer' });
    expect(getPosts()).toEqual([post]);
    expect(getPost(post.id)).toEqual(post);
  });

  it('sorts all valid posts newest first without changing stored order and drops malformed records', () => {
    const base = createPost(input);
    const older = { ...base, id: 'older', createdAt: '2020-01-01T00:00:00.000Z' };
    const newer = { ...base, id: 'newer', createdAt: '2025-01-01T00:00:00.000Z' };
    savePosts([older, {}, [], { ...base, createdAt: 'bad' }, { ...base, title: 12 }, newer]);
    const stored = getPosts();
    expect(sortedPosts()).toEqual([newer, older]);
    expect(getPosts()).toEqual(stored);
  });

  it.each([undefined, null, '', ' ', 12, {}, [], 'missing'])('returns null for invalid/missing identifier %j', id => {
    createPost(input);
    expect(getPost(id)).toBeNull();
  });

  it.each(['invalid json', '{}', 'null'])('reads corrupted collections gracefully: %s', raw => {
    localStorage.setItem('writespace_posts', raw);
    expect(sortedPosts()).toEqual([]);
    expect(getPost('missing')).toBeNull();
  });

  it('falls back safely when storage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(sortedPosts()).toEqual([]);
    expect(getPost('missing')).toBeNull();
    expect(canManage({}, owner)).toBe(false);
    expect(() => createPost(input)).toThrow(/log in/);
  });

  it('formats padded English UTC dates and rejects invalid values', () => {
    expect(formatPostDate('2026-03-04T12:00:00.000Z')).toBe('Mar 04, 2026');
    for (const value of ['bad', '', null, 12, {}]) expect(formatPostDate(value)).toBe('');
  });
});

describe('authorization and mutations', () => {
  it('rejects guests using default persisted identity on every operation', () => {
    const post = createPost(input);
    localStorage.removeItem('writespace_session');
    expect(canManage(post)).toBe(false);
    expect(() => createPost(input)).toThrow(/log in/);
    expect(() => updatePost(post.id, input)).toThrow(/log in/);
    expect(() => deletePost(post.id)).toThrow(/log in/);
    expect(getPosts()).toEqual([post]);
  });

  it('allows owner/admin and denies guest/nonowner/forged or malformed identity and posts', () => {
    const post = createPost(input);
    expect(canManage(post)).toBe(true);
    expect(canManage(post, admin)).toBe(true);
    for (const session of [null, {}, [], 12, other, { ...owner, role: 'admin' }, { ...owner, displayName: 'Fake' }]) {
      expect(canManage(post, session)).toBe(false);
    }
    for (const record of [null, {}, [], 12, { ...post, authorId: null }, { ...post, content: {} }]) {
      expect(canManage(record, admin)).toBe(false);
    }
  });

  it.each([null, {}, [], 12, { ...other, role: 'ADMIN' }, { ...other, userId: 'gone' }])(
    'rejects invalid identity %j on every mutation without changing storage', session => {
      const post = createPost(input);
      expect(() => createPost(input, session)).toThrow(/log in/);
      expect(() => updatePost(post.id, input, session)).toThrow(/log in/);
      expect(() => deletePost(post.id, session)).toThrow(/log in/);
      expect(getPosts()).toEqual([post]);
    },
  );

  it('rejects a removed account even with a previously valid session', () => {
    const post = createPost(input);
    saveUsers([]);
    expect(canManage(post, owner)).toBe(false);
    expect(() => createPost(input, owner)).toThrow(/log in/);
    expect(() => updatePost(post.id, input, owner)).toThrow(/log in/);
    expect(() => deletePost(post.id, owner)).toThrow(/log in/);
    expect(getPosts()).toEqual([post]);
  });

  it('rejects non-owner edits/deletion at the operation boundary', () => {
    const post = createPost(input);
    login('other', 'demo');
    expect(() => updatePost(post.id, input)).toThrow(/another writer/);
    expect(() => deletePost(post.id)).toThrow(/another writer/);
    expect(getPosts()).toEqual([post]);
  });

  it.each([owner => owner, () => admin])('updates and deletes as owner/admin while preserving metadata and other records', identity => {
    const post = createPost(input);
    const keep = createPost({ title: 'Keep', content: 'Keep content' }, other);
    const updated = updatePost(post.id, {
      title: 'Changed', content: 'New\ncontent', id: 'fake', createdAt: 'fake', authorId: 'fake', authorName: 'fake',
    }, identity(owner));
    expect(updated).toEqual({ ...post, title: 'Changed', content: 'New\ncontent' });
    expect(getPost(post.id)).toEqual(updated);
    expect(getPosts()).toEqual([updated, keep]);
    deletePost(post.id, identity(owner));
    expect(getPosts()).toEqual([keep]);
  });

  it('admin creation uses admin identity', () => {
    const post = createPost(input, admin);
    expect(getPosts()).toEqual([post]);
    expect(post).toMatchObject({ authorId: 'admin', authorName: 'Admin' });
  });

  it.each([undefined, null, '', ' ', 12, {}, [], 'missing'])('rejects invalid/missing mutation id %j', id => {
    const post = createPost(input);
    expect(() => updatePost(id, input)).toThrow('Post not found');
    expect(() => deletePost(id)).toThrow('Post not found');
    expect(getPosts()).toEqual([post]);
  });

  it.each([undefined, null, 12, [], {}, { title: ' ', content: '\n' }, { title: 12, content: {} }])(
    'rejects malformed form input %j with field errors on create and update', values => {
      const post = createPost(input);
      for (const operation of [() => createPost(values), () => updatePost(post.id, values)]) {
        try {
          operation();
          expect.fail('Expected validation failure');
        } catch (error) {
          expect(error.fields).toEqual({ title: 'Title is required.', content: 'Content is required.' });
        }
      }
      expect(getPosts()).toEqual([post]);
    },
  );

  it.each([{ title: 'Title', content: '' }, { title: '', content: 'Content' }])('validates each field independently', values => {
    const post = createPost(input);
    for (const operation of [() => createPost(values), () => updatePost(post.id, values)]) {
      try {
        operation();
        expect.fail('Expected field validation failure');
      } catch (error) {
        expect(error.fields).toEqual(values.title ? { content: 'Content is required.' } : { title: 'Title is required.' });
      }
    }
    expect(getPosts()).toEqual([post]);
  });

  it('reports missing secure UUID support without writing', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => createPost(input)).toThrow(/UUID support/);
    expect(getPosts()).toEqual([]);
  });

  it.each(['create', 'update', 'delete'])('surfaces %s write failure and preserves existing records', operation => {
    const post = createPost(input);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const action = {
      create: () => createPost(input), update: () => updatePost(post.id, { title: 'New', content: 'New' }),
      delete: () => deletePost(post.id),
    }[operation];
    expect(action).toThrow(/storage is unavailable or full/);
    expect(getPosts()).toEqual([post]);
  });
});
