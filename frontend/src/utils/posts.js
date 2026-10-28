/** Validate browser-local posts and enforce author/admin rights before mutations. */
import { getPosts, savePosts } from './storage.js';
import { getSession, validateSession } from './auth.js';

/** Check meaningful text without coercing untrusted values. */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Reject malformed records before sorting, rendering or authorizing them. */
function validPost(post) {
  return Boolean(post && typeof post === 'object' && !Array.isArray(post)
    && ['id', 'title', 'content', 'authorId', 'authorName', 'createdAt'].every(key => hasText(post[key]))
    && Number.isFinite(Date.parse(post.createdAt)));
}

/** Return usable posts newest first without mutating stored order.
 * @returns {object[]} Independently read, sorted records; empty on corrupt/unavailable storage.
 */
export function sortedPosts() {
  return getPosts().filter(validPost).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Find a usable post by exact identity.
 * @param {*} id Requested post identifier.
 * @returns {object|null} Post or null for invalid/missing identifiers.
 */
export function getPost(id) {
  return hasText(id) ? sortedPosts().find(post => post.id === id) || null : null;
}

/** Revalidate identity and decide whether an author or admin can manage a record.
 * @param {*} post Candidate post.
 * @param {*} session Candidate session, defaulting to persisted identity.
 * @returns {boolean} Fail-closed ownership decision.
 */
export function canManage(post, session = getSession()) {
  const identity = validateSession(session);
  return Boolean(identity && validPost(post) && (identity.role === 'admin' || identity.userId === post.authorId));
}

/** Require a currently valid account before creating or changing records. */
function requireSession(session) {
  const identity = validateSession(session);
  if (!identity) throw new Error('Please log in to manage posts.');
  return identity;
}

/** Validate required fields and preserve plaintext content, including line breaks. */
function postFields(input) {
  const fields = {};
  if (!hasText(input?.title)) fields.title = 'Title is required.';
  if (!hasText(input?.content)) fields.content = 'Content is required.';
  if (Object.keys(fields).length) {
    throw Object.assign(new Error('Please correct the highlighted fields.'), { fields });
  }
  return { title: input.title.trim(), content: input.content };
}

/** Create a post using only validated identity and generated metadata.
 * @param {*} input Submitted title and plaintext content.
 * @param {*} session Candidate session, defaulting to persisted identity.
 * @returns {object} Saved post.
 * @throws {Error} For invalid identity, fields, UUID support or persistence failure.
 */
export function createPost(input, session = getSession()) {
  const identity = requireSession(session);
  const values = postFields(input);
  let post;
  try {
    post = {
      ...values, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      authorId: identity.userId, authorName: identity.displayName,
    };
  } catch {
    throw new Error('Could not create a local post. Please use a browser with secure UUID support.');
  }
  savePosts([...getPosts(), post]);
  return post;
}

/** Update only title/content, preserving original author, identity and creation time.
 * @param {*} id Requested post identifier.
 * @param {*} input Submitted title and plaintext content.
 * @param {*} session Candidate session, defaulting to persisted identity.
 * @returns {object} Updated post.
 * @throws {Error} For guests, missing records, non-owners, invalid fields or failed writes.
 */
export function updatePost(id, input, session = getSession()) {
  const identity = requireSession(session);
  const post = getPost(id);
  if (!post) throw new Error('Post not found');
  if (!canManage(post, identity)) throw new Error('You cannot manage another writer’s post.');
  const updated = { ...post, ...postFields(input) };
  savePosts(getPosts().map(item => item.id === id ? updated : item));
  return updated;
}

/** Delete a post only after rechecking current account and record ownership.
 * @param {*} id Requested post identifier.
 * @param {*} session Candidate session, defaulting to persisted identity.
 * @returns {void}
 * @throws {Error} For guests, missing records, non-owners or failed writes.
 */
export function deletePost(id, session = getSession()) {
  const identity = requireSession(session);
  const post = getPost(id);
  if (!post) throw new Error('Post not found');
  if (!canManage(post, identity)) throw new Error('You cannot manage another writer’s post.');
  savePosts(getPosts().filter(item => item.id !== id));
}

/** Format a stored creation date consistently for cards and readers.
 * @param {string} value Stored date.
 * @returns {string} English month/day/year, or an empty string for invalid dates.
 */
export function formatPostDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '';
  const date = new Date(value);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${String(date.getUTCDate()).padStart(2, '0')}, ${date.getUTCFullYear()}`;
}
