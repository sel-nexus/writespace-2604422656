/** Verify safe reads and explicit write failures. */
import { getPosts, savePosts, getUsers, saveUsers } from '../utils/storage';
describe('storage', () => {
  it('persists and re-reads posts and accounts', () => {
    savePosts([{ id: 'p' }]); saveUsers([{ id: 'u' }]);
    expect(getPosts()).toEqual([{ id: 'p' }]); expect(getUsers()).toEqual([{ id: 'u' }]);
  });
  it.each(['{', 'null', '{}', '3'])('falls back for invalid array %s', value => {
    localStorage.setItem('writespace_posts', value);
    expect(getPosts()).toEqual([]);
  });
  it('ignores null and primitive records', () => {
    localStorage.setItem('writespace_users', '[null, 2, {"id":"u"}]');
    expect(getUsers()).toEqual([{ id: 'u' }]);
  });
  it('falls back for unavailable reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getPosts()).toEqual([]); expect(getUsers()).toEqual([]);
  });
  it('rejects non-arrays before writing', () => { expect(() => savePosts({})).toThrow('array'); });
  it('reports failed writes without claiming success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveUsers([])).toThrow('Nothing was saved');
  });
});
