/** Exercise administrator account and cross-feature post journeys through real UI actions. */
import { test, expect } from './fixtures.js';

/** Sign in via public navigation rather than injecting session data. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

/** Follow a visible workspace link on desktop or mobile. */
async function navigate(page, label) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('link', { name: label, exact: true }).click();
}

/** Log out through the real account disclosure. */
async function logout(page, name) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('button', { name: `Account: ${name}` }).click();
  await nav.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Create a demo account using the required administrator form. */
async function createAccount(page, name, username, role) {
  await page.getByLabel('Display Name').fill(name);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('demo-only');
  await page.getByLabel('Role').selectOption(role);
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('status')).toContainText(`Account created for ${name}.`);
}

/** Return the responsive, visible deletion button, not the hidden duplicate layout. */
function deleteButton(page, username) {
  return page.locator(`button[aria-label="Delete ${username}"]:visible`);
}

/** Read saved records for outcome assertions without modifying application state. */
async function stored(page, collection) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(`writespace_${key}`)) || [], collection);
}

/** Check true dashboard counts by their accessible statistic regions. */
async function counts(page, posts, accounts, admins, writers) {
  for (const [label, value] of [
    ['Total Posts', posts], ['Total Accounts', accounts], ['Total Admins', admins], ['Total Writers', writers],
  ]) {
    await expect(page.getByRole('region', { name: label }).locator('p')).toHaveText(String(value));
  }
}

test('admin creates both roles, rejects invalid/duplicate fields, protects default/self and persists confirmed deletion', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await counts(page, 0, 1, 1, 0);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
  await expect(page.getByText(/Do not use real passwords/)).toBeVisible();
  await page.getByRole('button', { name: 'Create User' }).click();
  for (const message of ['Display name is required.', 'Username is required.', 'Password is required.', 'Role is required.']) {
    await expect(page.getByText(message)).toBeVisible();
  }
  expect(await stored(page, 'users')).toEqual([]);
  await createAccount(page, 'Mira', 'mira', 'user');
  await createAccount(page, 'Editor', 'editor', 'admin');
  const accounts = await stored(page, 'users');
  expect(accounts.map(account => account.role)).toEqual(['user', 'admin']);
  for (const account of accounts) {
    expect(account.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await page.getByLabel('Display Name').fill('Duplicate');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByLabel('Role').selectOption('user');
  for (const username of ['admin', 'mira']) {
    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByText('Username is already taken.')).toBeVisible();
    expect(await stored(page, 'users')).toEqual(accounts);
  }
  await expect(deleteButton(page, 'admin')).toBeDisabled();
  await expect(deleteButton(page, 'admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await deleteButton(page, 'mira').click();
  expect(await stored(page, 'users')).toEqual(accounts);
  page.once('dialog', async dialog => dialog.accept());
  await deleteButton(page, 'mira').click();
  await expect(page.getByRole('heading', { name: 'Accounts (2)' })).toBeVisible();
  expect(await stored(page, 'users')).toEqual([accounts[1]]);
  await navigate(page, 'Admin Dashboard');
  await counts(page, 0, 2, 2, 0);
  await logout(page, 'Admin');
  await login(page, 'editor', 'demo-only');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(deleteButton(page, 'editor')).toBeDisabled();
  await expect(deleteButton(page, 'editor')).toHaveAttribute('title', 'You cannot delete your own account.');
  await expect(deleteButton(page, 'admin')).toBeDisabled();
  expect(await stored(page, 'users')).toEqual([accounts[1]]);
});

test('admin account creation flows into writer login/post and admin dashboard counts/edit/delete with historical author retained', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await createAccount(page, 'Mira', 'mira', 'user');
  const [account] = await stored(page, 'users');
  await logout(page, 'Admin');
  await login(page, 'mira', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Admin Dashboard', exact: true })).toHaveCount(0);
  await navigate(page, 'Write');
  await page.getByLabel('Title').fill('Mira’s local story');
  await page.getByLabel('Content').fill('Original historical writing.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Mira’s local story' })).toBeVisible();
  const [original] = await stored(page, 'posts');
  expect(original).toMatchObject({ authorId: account.id, authorName: 'Mira', content: 'Original historical writing.' });
  await logout(page, 'Mira');
  await login(page);
  await counts(page, 1, 2, 1, 1);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('link', { name: 'Mira’s local story', exact: true })).toBeVisible();
  await recent.getByRole('link', { name: 'Edit Mira’s local story' }).click();
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
  expect(await stored(page, 'posts')).toEqual([{ ...original, title: 'Admin revision' }]);
  await navigate(page, 'Users');
  page.once('dialog', async dialog => dialog.accept());
  await deleteButton(page, 'mira').click();
  expect(await stored(page, 'users')).toEqual([]);
  expect(await stored(page, 'posts')).toEqual([{ ...original, title: 'Admin revision' }]);
  await navigate(page, 'Admin Dashboard');
  await counts(page, 1, 1, 1, 0);
  await expect(page.getByRole('region', { name: 'Recent Posts' })).toContainText('Mira');
  page.once('dialog', async dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  expect(await stored(page, 'posts')).toHaveLength(1);
  page.once('dialog', async dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  await counts(page, 0, 1, 1, 0);
  await expect(page.getByText('No posts yet. Write your first post to begin.')).toBeVisible();
  expect(await stored(page, 'posts')).toEqual([]);
  await navigate(page, 'All Blogs');
  await navigate(page, 'Admin Dashboard');
  await counts(page, 0, 1, 1, 0);
  expect(await stored(page, 'posts')).toEqual([]);
});

for (const path of ['/admin', '/users']) {
  test(`guest initial deep link ${path} fails closed`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await stored(page, 'users')).toEqual([]);
  });
}
