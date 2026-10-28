/** Manage plaintext demo accounts and validated browser-local sessions; never use real passwords. */
import { getUsers, saveUsers } from './storage.js';

export const SESSION_KEY = 'writespace_session';
export const DEFAULT_ADMIN = Object.freeze({ id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin' });

/** Check whether a required field contains meaningful text.
 * @param {*} value Candidate field.
 * @returns {boolean} Whether the field is nonempty text.
 */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Reject malformed stored accounts before using their identity or credentials.
 * @param {*} account Stored account.
 * @returns {boolean} Whether the account has usable identity and a lowercase role.
 */
export function isValidAccount(account) {
  return Boolean(account && !Array.isArray(account) && hasText(account.id)
    && account.id !== 'admin' && hasText(account.displayName) && hasText(account.username)
    && account.username !== 'admin' && hasText(account.password)
    && ['admin', 'user'].includes(account.role) && hasText(account.createdAt)
    && Number.isFinite(Date.parse(account.createdAt)));
}

/** Return the permanent demo admin followed by usable non-default accounts.
 * @returns {object[]} Accounts without inventing missing stored fields.
 */
export function getAccounts() {
  return [DEFAULT_ADMIN, ...getUsers().filter(isValidAccount)];
}

/** Project an account into the password-free session schema.
 * @param {object} account Account identity.
 * @returns {object} Session fields used by navigation and ownership checks.
 */
export function sessionFor(account) {
  return { userId: account.id, username: account.username, displayName: account.displayName, role: account.role };
}

/** Validate every session identity field against the current account collection.
 * @param {*} value Candidate persisted session.
 * @returns {object|null} Canonical session, or null for malformed, changed or removed accounts.
 */
export function validateSession(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  if (!['userId', 'username', 'displayName', 'role'].every(key => hasText(value[key]))) return null;
  if (!['admin', 'user'].includes(value.role)) return null;
  const account = getAccounts().find(item => item.id === value.userId);
  if (!account) return null;
  const canonical = sessionFor(account);
  return Object.keys(canonical).every(key => canonical[key] === value[key]) ? canonical : null;
}

/** Read and revalidate a session without ever throwing on unavailable or corrupt storage.
 * @returns {object|null} Current validated session, or guest state.
 */
export function getSession() {
  try {
    return validateSession(JSON.parse(localStorage.getItem(SESSION_KEY)));
  } catch {
    return null;
  }
}

/** Persist only a session matching a currently existing account.
 * @param {object} value Candidate session.
 * @returns {object} Canonical persisted session.
 * @throws {Error} If identity is invalid or browser storage cannot save it.
 */
export function setSession(value) {
  const session = validateSession(value);
  if (!session) throw new Error('This account session is invalid. Please log in again.');
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error('Browser storage is unavailable or full. Your session could not be saved.');
  }
  return session;
}

/** Remove the active session; surface failures rather than pretending logout succeeded.
 * @throws {Error} If browser storage cannot remove the session.
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error('Browser storage is unavailable. Could not log out. Please try again.');
  }
}

/** Choose the role home without adding feature-page dependencies.
 * @param {object} session Validated identity.
 * @returns {string} Role-specific workspace route.
 */
export function roleHome(session) {
  return session?.role === 'admin' ? '/admin' : '/blogs';
}

/** Check submitted credentials, preferring the permanent admin, and persist success.
 * @param {string} username Submitted username.
 * @param {string} password Plaintext demo password.
 * @returns {object} Validated session on success.
 * @throws {Error} If fields, credentials or persistence are invalid.
 */
export function login(username, password) {
  const fields = {};
  if (!hasText(username)) fields.username = 'Username is required.';
  if (!hasText(password)) fields.password = 'Password is required.';
  if (Object.keys(fields).length) throw Object.assign(new Error('Please complete all required fields.'), { fields });
  const name = username.trim();
  const account = name === 'admin' && password === 'admin'
    ? DEFAULT_ADMIN
    : getUsers().filter(isValidAccount).find(item => item.username === name && item.password === password);
  if (!account) throw new Error('Invalid username or password.');
  return setSession(sessionFor(account));
}

/** Create only an ordinary user, then persist the new session.
 * @param {object} input Display name, username, password and confirmation from the form.
 * @returns {object} New password-free session.
 * @throws {Error} If required fields, uniqueness, confirmation or storage fail.
 */
export function register(input = {}) {
  const { displayName, username, password, confirmPassword } = input || {};
  const fields = {};
  for (const [key, label, value] of [
    ['displayName', 'Display name', displayName], ['username', 'Username', username],
    ['password', 'Password', password], ['confirmPassword', 'Confirm password', confirmPassword],
  ]) {
    if (!hasText(value)) fields[key] = `${label} is required.`;
  }
  if (hasText(password) && hasText(confirmPassword) && password !== confirmPassword) {
    fields.confirmPassword = 'Passwords must match.';
  }
  const users = getUsers();
  if (hasText(username) && (username.trim() === 'admin' || users.some(item => item.username === username.trim()))) {
    fields.username = 'Username is already taken.';
  }
  if (Object.keys(fields).length) throw Object.assign(new Error('Please correct the highlighted fields.'), { fields });
  let account;
  try {
    account = {
      id: crypto.randomUUID(), displayName: displayName.trim(), username: username.trim(),
      password, role: 'user', createdAt: new Date().toISOString(),
    };
  } catch {
    throw new Error('Could not create a local account. Please use a browser with secure UUID support.');
  }
  saveUsers([...users, account]);
  return setSession(sessionFor(account));
}
