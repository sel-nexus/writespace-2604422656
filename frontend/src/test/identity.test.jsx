/** Exercise actual forms, role destinations and responsive/account navigation in isolated routes. */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import App from '../App.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { getAvatar } from '../components/Avatar.jsx';
import { clearSession, getSession, login, register, roleHome } from '../utils/auth.js';
import { saveUsers } from '../utils/storage.js';

const writer = { displayName: 'Mira', username: 'mira', password: 'demo-only', confirmPassword: 'demo-only' };

/** Provide genuine role destinations in tests without adding feature stubs to production. */
function IdentityRoutes() {
  const [session, setSession] = useState(getSession);
  const navigate = useNavigate();
  /** Propagate the same state transition as App. */
  function authenticated(next) {
    setSession(next);
    navigate(roleHome(next), { replace: true });
  }
  /** Remove storage before changing the visible authenticated shell. */
  function logout() {
    clearSession();
    setSession(null);
    navigate('/');
  }
  return (
    <>
      {session && <Navbar session={session} onLogout={logout} />}
      <Routes>
        <Route path="/" element={<Link to="/login">Login</Link>} />
        <Route path="/login" element={<LoginPage session={session} onAuthenticated={authenticated} />} />
        <Route path="/register" element={<RegisterPage session={session} onAuthenticated={authenticated} />} />
        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/blogs" element={<h1>All Blogs</h1>} />
          <Route path="/write" element={<h1>Write a post</h1>} />
        </Route>
        <Route element={<ProtectedRoute session={session} adminOnly />}>
          <Route path="/admin" element={<h1>Admin Dashboard</h1>} />
          <Route path="/users" element={<h1>User Management</h1>} />
        </Route>
      </Routes>
    </>
  );
}

/** Render a single initial location and navigate thereafter through visible controls. */
function renderIdentity(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <IdentityRoutes />
    </MemoryRouter>,
  );
}

/** Fill registration through labelled controls. */
async function fillRegistration(user, username = 'mira', confirmation = 'demo-only') {
  await user.type(screen.getByLabelText('Display Name'), 'Mira');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'demo-only');
  await user.type(screen.getByLabelText('Confirm Password'), confirmation);
}

describe('identity forms and destinations', () => {
  it('submits missing login fields, displays associated errors, then rejects invalid credentials before valid admin login', async () => {
    const user = userEvent.setup();
    renderIdentity();
    expect(screen.getByText(/Do not use real passwords/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required.');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(getSession()).toBeNull();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    expect(getSession().userId).toBe('admin');
  });

  it('submits missing registration fields then creates a persisted ordinary writer at All Blogs', async () => {
    const user = userEvent.setup();
    renderIdentity('/register');
    expect(screen.getByText(/Do not use real passwords/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label, { exact: true })).toHaveAccessibleDescription(/required/);
    }
    await fillRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Account: Mira' })).toBeVisible();
    expect(getSession()).toMatchObject({ username: 'mira', displayName: 'Mira', role: 'user' });
  });

  it.each(['admin', 'mira'])('shows duplicate %s and mismatch errors through actual registration submission', async username => {
    if (username === 'mira') {
      register(writer);
      clearSession();
    }
    const user = userEvent.setup();
    renderIdentity('/register');
    await fillRegistration(user, username, 'different');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is already taken.');
    expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords must match.');
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(getSession()).toBeNull();
  });

  it.each(['/login', '/register'])('redirects an authenticated ordinary user from %s to blogs', async path => {
    register(writer);
    renderIdentity(path);
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
  });

  it.each(['/login', '/register'])('redirects an authenticated admin from %s to admin home', async path => {
    login('admin', 'admin');
    renderIdentity(path);
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  it('navigates between identity forms using their actual links', async () => {
    const user = userEvent.setup();
    renderIdentity();
    await user.click(screen.getByRole('link', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  it.each(['/login', '/register'])('shows browser write failure on submitted %s without leaving the form', async path => {
    const user = userEvent.setup();
    renderIdentity(path);
    if (path === '/register') await fillRegistration(user);
    else {
      await user.type(screen.getByLabelText('Username'), 'admin');
      await user.type(screen.getByLabelText('Password'), 'admin');
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await user.click(screen.getByRole('button', { name: path === '/register' ? 'Register' : 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage');
    expect(getSession()).toBeNull();
  });
});

describe('guards and navigation', () => {
  it.each(['/write', '/admin', '/users'])('sends a guest deep link %s to the real login form', async path => {
    renderIdentity(path);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  it.each(['/admin', '/users'])('denies a self-registered writer access to %s', async path => {
    register(writer);
    renderIdentity(path);
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).not.toBeInTheDocument();
  });

  it('fails closed for a removed user even when a stale session is supplied to the guard', async () => {
    const session = register(writer);
    saveUsers([]);
    render(
      <MemoryRouter initialEntries={['/write']}>
        <Routes>
          <Route path="/login" element={<h1>Login required</h1>} />
          <Route path="/write" element={<ProtectedRoute session={session}><h1>Write</h1></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Login required' })).toBeVisible();
  });

  it('opens and closes mobile navigation, marks active links and navigates with admin links', async () => {
    const user = userEvent.setup();
    login('admin', 'admin');
    renderIdentity('/admin');
    expect(screen.getByRole('link', { name: 'Admin Dashboard' })).toHaveAttribute('aria-current', 'page');
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('link', { name: 'Users' }));
    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Write' }));
    expect(await screen.findByRole('heading', { name: 'Write a post' })).toBeVisible();
  });

  it('closes the account disclosure with Escape and logs out through its actual button', async () => {
    const user = userEvent.setup();
    register(writer);
    renderIdentity('/blogs');
    const account = screen.getByRole('button', { name: 'Account: Mira' });
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await user.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    await user.click(account);
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  it('keeps the session and shows an error if logout storage removal fails', async () => {
    const user = userEvent.setup();
    login('admin', 'admin');
    renderIdentity('/admin');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    await user.click(screen.getByRole('button', { name: 'Account: Admin' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out');
    expect(getSession().role).toBe('admin');
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  it('returns actual decorative Phosphor SVG for both avatar roles', () => {
    const { container } = render(
      <div>
        {getAvatar('admin')}
        {getAvatar('user')}
      </div>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('keeps the public navbar at / even when authenticated', () => {
    login('admin', 'admin');
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    const publicNav = screen.getByRole('navigation', { name: 'Public navigation' });
    expect(within(publicNav).getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  });

  it.each(['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'])(
    'wires the App guest guard at %s without feature placeholders', async path => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    },
  );
});
