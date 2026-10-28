/** Manage demo accounts without changing historical post authors or the active session. */
import { DEFAULT_ADMIN, getAccounts, getSession, validateSession } from './auth.js';
import { getUsers, saveUsers } from './storage.js';
import { sortedPosts } from './posts.js';

/** Require canonical administrator identity before reading privileged data or mutating accounts.
 * @param {*} session Candidate identity.
 * @returns {object} Revalidated administrator session.
 * @throws {Error} When identity is missing, malformed, removed or not an administrator.
 */
function requireAdmin(session) {
  const identity = validateSession(session);
  if (!identity || identity.role !== 'admin') throw new Error('Administrator access is required.');
  return identity;
}

/** Validate required text without coercing invalid values. */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Create a uniquely named account with generated metadata, keeping passwords demo-only.
 * @param {*} input Display name, username, plaintext password and lowercase role.
 * @param {*} session Candidate administrator, defaulting to persisted identity.
 * @returns {object} Saved account, not a new session.
 * @throws {Error} For unauthorized access, invalid fields, duplicates, UUID or write failures.
 */
export function createUser(input, session = getSession()) {
  requireAdmin(session);
  const fields = {};
  for (const [key, label] of [['displayName', 'Display name'], ['username', 'Username'], ['password', 'Password']]) {
    if (!hasText(input?.[key])) fields[key] = `${label} is required.`;
  }
  if (!hasText(input?.role)) fields.role = 'Role is required.';
  else if (!['admin', 'user'].includes(input.role)) fields.role = 'Choose Admin or user.';
  const users = getUsers();
  if (hasText(input?.username) && (input.username.trim() === DEFAULT_ADMIN.username
    || users.some(account => account.username === input.username.trim()))) {
    fields.username = 'Username is already taken.';
  }
  if (Object.keys(fields).length) {
    throw Object.assign(new Error('Please correct the highlighted fields.'), { fields });
  }
  let account;
  try {
    account = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      displayName: input.displayName.trim(), username: input.username.trim(), password: input.password, role: input.role,
    };
  } catch {
    throw new Error('Could not create a local account. Please use a browser with secure UUID support.');
  }
  saveUsers([...users, account]);
  return account;
}

/** Remove an eligible account while retaining every post and its original authorName.
 * @param {*} id Exact account identifier.
 * @param {*} session Candidate administrator, defaulting to persisted identity.
 * @returns {void}
 * @throws {Error} For unauthorized, permanent/self, missing targets or failed persistence.
 */
export function deleteUser(id, session = getSession()) {
  const identity = requireAdmin(session);
  if (id === DEFAULT_ADMIN.id) throw new Error('Default admin cannot be deleted.');
  if (id === identity.userId) throw new Error('You cannot delete your own account.');
  if (!hasText(id) || !getAccounts().some(account => account.id === id)) throw new Error('User not found.');
  saveUsers(getUsers().filter(account => account.id !== id));
}

/** Requery current storage for the four approved totals, including the permanent admin.
 * @param {*} session Candidate administrator, defaulting to persisted identity.
 * @returns {object} Distinct posts, accounts, admins and ordinary writer counts.
 * @throws {Error} When administrator identity is invalid.
 */
export function getStats(session = getSession()) {
  requireAdmin(session);
  const accounts = getAccounts();
  return {
    posts: sortedPosts().length, accounts: accounts.length,
    admins: accounts.filter(account => account.role === 'admin').length,
    writers: accounts.filter(account => account.role === 'user').length,
  };
}
