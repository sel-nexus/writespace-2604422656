/** Persist local demo records and fail visibly when browser writes are unavailable. */
const keys = { posts: 'writespace_posts', users: 'writespace_users' };
/** Read an array safely.
 * Args: key: Browser-local record key.
 * Returns: Stored array, or an empty array for unavailable/corrupt storage.
 */
function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch { return []; }
}
/** Save records or report unavailable storage.
 * Raises: Error when persistence cannot be completed.
 */
function saveArray(key, records) {
  if (!Array.isArray(records)) throw new Error('Records must be an array.');
  try { localStorage.setItem(key, JSON.stringify(records)); }
  catch { throw new Error('Browser storage is unavailable or full. Nothing was saved.'); }
}
/** Read browser-local posts. */
export function getPosts() { return readArray(keys.posts); }
/** Persist the complete post collection. */
export function savePosts(records) { saveArray(keys.posts, records); }
/** Read browser-local accounts. */
export function getUsers() { return readArray(keys.users); }
/** Persist non-default accounts. */
export function saveUsers(records) { saveArray(keys.users, records); }
