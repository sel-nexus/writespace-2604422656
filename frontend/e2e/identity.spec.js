/** Verify identity journeys against the final feature routes, using automatic console-error checks. */
import { test, expect } from './fixtures.js';

test('register, reload, logout, invalid then valid login, and admin role home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started' }).click();
  await expect(page.getByText(/Do not use real passwords/)).toBeVisible();
  await page.getByLabel('Display Name').fill('Mira');
  await page.getByLabel('Username').fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password').fill('demo-only');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session).toMatchObject({ username: 'mira', displayName: 'Mira', role: 'user' });
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({ id: session.userId, username: 'mira', role: 'user', password: 'demo-only' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account: Mira' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  await page.getByRole('button', { name: 'Account: Mira' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill('mira');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account: Mira' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin',
  });
});

const writerAccount = {
  id: 'writer-mira', displayName: 'Mira', username: 'mira', password: 'demo-only',
  role: 'user', createdAt: '2026-01-01T00:00:00.000Z',
};
const writerSession = { userId: 'writer-mira', username: 'mira', displayName: 'Mira', role: 'user' };
const adminSession = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

for (const path of ['/admin', '/users']) {
  test(`seeded writer initial entry at ${path} redirects to blogs without administrator content`, async ({ page }) => {
    const users = JSON.stringify([writerAccount]);
    const session = JSON.stringify(writerSession);
    await page.addInitScript(({ users, session }) => {
      localStorage.setItem('writespace_users', users);
      localStorage.setItem('writespace_session', session);
    }, { users, session });
    await page.goto(path);
    await expect(page).toHaveURL(new URL('/blogs', page.url()).href);
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account: Mira' })).toBeVisible();
    for (const name of ['Admin Dashboard', 'User Management']) {
      await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
    }
    for (const name of ['Admin Dashboard', 'Users']) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(users);
  });
}

for (const identity of [writerSession, adminSession]) {
  for (const path of ['/login', '/register']) {
    test(`seeded ${identity.role} initial entry at ${path} redirects to exact role home without identity forms`, async ({ page }) => {
      const users = JSON.stringify([writerAccount]);
      const session = JSON.stringify(identity);
      await page.addInitScript(({ users, session }) => {
        localStorage.setItem('writespace_users', users);
        localStorage.setItem('writespace_session', session);
      }, { users, session });
      await page.goto(path);
      const home = identity.role === 'admin' ? '/admin' : '/blogs';
      await expect(page).toHaveURL(new URL(home, page.url()).href);
      await expect(page.getByRole('heading', {
        name: identity.role === 'admin' ? 'Admin Dashboard' : 'All Blogs', exact: true,
      })).toBeVisible();
      await expect(page.getByRole('button', { name: `Account: ${identity.displayName}` })).toBeVisible();
      for (const name of ['Welcome back', 'Create your account']) {
        await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
      }
      for (const name of ['Login', 'Register']) {
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
      }
      await expect(page.getByLabel('Username', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
      if (identity.role === 'user') {
        await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
      }
      expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
      expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(users);
    });
  }
}

test('registration required fields and mismatch feedback leave storage untouched before successful correction', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  for (const [label, message] of [
    ['Display Name', 'Display name is required.'], ['Username', 'Username is required.'],
    ['Password', 'Password is required.'], ['Confirm Password', 'Confirm password is required.'],
  ]) {
    const field = page.getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(message);
    await expect(page.getByText(message, { exact: true })).toHaveText(message);
  }
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Display Name').fill('Mira');
  await page.getByLabel('Username').fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password').fill('different');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(new URL('/register', page.url()).href);
  await expect(page.getByLabel('Confirm Password')).toHaveAccessibleDescription('Passwords must match.');
  await expect(page.getByRole('alert')).toHaveText('Passwords must match.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Confirm Password').fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(new URL('/blogs', page.url()).href);
  await expect(page.getByRole('button', { name: 'Account: Mira' })).toBeVisible();
});

for (const username of ['admin', 'mira']) {
  test(`registration displays duplicate ${username} feedback without changing existing accounts`, async ({ page }) => {
    const users = JSON.stringify([writerAccount]);
    await page.addInitScript(users => localStorage.setItem('writespace_users', users), users);
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Another writer');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Confirm Password').fill('demo-only');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(new URL('/register', page.url()).href);
    await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
    await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Username')).toHaveAccessibleDescription('Username is already taken.');
    await expect(page.getByRole('alert')).toHaveText('Username is already taken.');
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(users);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  });
}

test('guest initial deep link to write requires login', async ({ page }) => {
  await page.goto('/write');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('mobile workspace toggle and logout work through visible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  await nav.getByRole('button', { name: 'Open navigation' }).click();
  await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
  await nav.getByRole('button', { name: 'Close navigation' }).click();
  await expect(nav.getByRole('link', { name: 'Users' })).toBeHidden();
  await nav.getByRole('button', { name: 'Open navigation' }).click();
  await nav.getByRole('button', { name: 'Account: Admin' }).click();
  await nav.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});
