/** Exercise administrator forms, protected controls and real storage-backed dashboard changes. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import UserManagement from '../pages/UserManagement.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { UserRow } from '../components/UserRow.jsx';
import { DEFAULT_ADMIN, sessionFor, setSession } from '../utils/auth.js';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage.js';

const admin = sessionFor(DEFAULT_ADMIN);
const writer = {
  id: 'writer', username: 'mira', displayName: 'Mira', role: 'user', password: 'secret-demo',
  createdAt: '2026-03-04T12:00:00.000Z',
};

/** Render a standalone page with observable redirect destinations. */
function page(Component, session = admin) {
  return render(
    <MemoryRouter initialEntries={['/test']}>
      <Routes>
        <Route path="/test" element={<Component session={session} />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route path="/blogs" element={<h1>Blogs destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Fill required text fields using actual controlled input interactions. */
async function fillForm(user, { displayName = 'Mira', username = 'mira', password = 'demo-only', role = 'user' } = {}) {
  if (displayName) await user.type(screen.getByLabelText('Display Name'), displayName);
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (role) await user.selectOptions(screen.getByLabelText('Role'), role);
}

describe('standalone guards and App wiring', () => {
  for (const Component of [AdminDashboard, UserManagement]) {
    it.each([null, {}, { ...admin, displayName: 'Forged' }])(`${Component.name} rejects invalid identity %j`, session => {
      page(Component, session);
      expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create User' })).not.toBeInTheDocument();
    });
    it(`${Component.name} redirects ordinary users`, () => {
      saveUsers([writer]);
      page(Component, sessionFor(writer));
      expect(screen.getByRole('heading', { name: 'Blogs destination' })).toBeInTheDocument();
    });
    it(`${Component.name} uses persisted admin identity when no prop is supplied`, () => {
      setSession(admin);
      render(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        Component === AdminDashboard ? 'Admin Dashboard' : 'Manage Users',
      );
    });
  }
  it.each([['/admin', 'Admin Dashboard'], ['/users', 'Manage Users']])('App wires %s to the real admin page', (path, heading) => {
    setSession(admin);
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });
  it.each(['/admin', '/users'])('App denies guests on %s', path => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('account creation form', () => {
  it.each(['user', 'admin'])('submits a valid %s account, clears fields, shows success and both responsive structures', async role => {
    const user = userEvent.setup();
    const { container } = page(UserManagement);
    expect(screen.getByText(/Demo only: passwords are stored as plaintext/)).toHaveTextContent('Do not use real passwords');
    await fillForm(user, { role });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(getUsers()).toHaveLength(1);
    expect(getUsers()[0]).toMatchObject({ displayName: 'Mira', username: 'mira', password: 'demo-only', role });
    expect(screen.getByRole('status')).toHaveTextContent('Account created for Mira.');
    expect(screen.getByLabelText('Display Name')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Role')).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'Accounts (2)' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('@mira')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Account mira' })).toHaveTextContent('@mira');
    expect(container.querySelector('table').parentElement).toHaveClass('hidden', 'sm:block');
    expect(container.querySelector('[aria-label="User account cards"]')).toHaveClass('sm:hidden');
    expect(container.textContent).not.toContain('demo-only');
  });
  it('submits an entirely empty form and associates all required-field errors', async () => {
    const user = userEvent.setup();
    page(UserManagement);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    for (const [label, message] of [
      ['Display Name', 'Display name is required.'], ['Username', 'Username is required.'],
      ['Password', 'Password is required.'], ['Role', 'Role is required.'],
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(message)).toHaveAttribute('role', 'alert');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
    }
    expect(getUsers()).toEqual([]);
  });
  it.each([
    ['displayName', 'Display name is required.'], ['username', 'Username is required.'],
    ['password', 'Password is required.'], ['role', 'Role is required.'],
  ])('rejects only missing %s on actual submission', async (key, message) => {
    const user = userEvent.setup();
    page(UserManagement);
    await fillForm(user, { [key]: '' });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(getUsers()).toEqual([]);
  });
  it.each(['admin', 'mira'])('shows duplicate %s validation and keeps the draft', async username => {
    saveUsers([writer]);
    const user = userEvent.setup();
    page(UserManagement);
    await fillForm(user, { username });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Username is already taken.');
    expect(screen.getByLabelText('Username')).toHaveValue(username);
    expect(getUsers()).toEqual([writer]);
  });
  it('surfaces a failed creation write without clearing the draft or reporting success', async () => {
    const user = userEvent.setup();
    page(UserManagement);
    await fillForm(user);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved');
    expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(getUsers()).toEqual([]);
  });
  it('reports UUID failure visibly on actual form submit', async () => {
    const user = userEvent.setup();
    page(UserManagement);
    await fillForm(user);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('secure UUID support');
    expect(getUsers()).toEqual([]);
  });
});

describe('account rows and deletion', () => {
  it.each([false, true])('uses avatars/date without passwords in mobile=%s', mobile => {
    const onDelete = vi.fn();
    saveUsers([writer]);
    const { container } = render(mobile ? (
      <UserRow account={writer} session={admin} onDelete={onDelete} mobile />
    ) : (
      <table>
        <tbody>
          <UserRow account={writer} session={admin} onDelete={onDelete} />
        </tbody>
      </table>
    ));
    expect(screen.getByText('Mar 04, 2026')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain(writer.password);
    fireEvent.click(screen.getByRole('button', { name: 'Delete mira' }));
    expect(onDelete).toHaveBeenCalledWith(writer.id);
  });
  it('disables default admin with exact title and non-default self with explanation in both layouts', () => {
    const self = { ...writer, role: 'admin' };
    saveUsers([self]);
    const confirm = vi.spyOn(window, 'confirm');
    page(UserManagement, sessionFor(self));
    for (const button of screen.getAllByRole('button', { name: 'Delete admin' })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Default admin cannot be deleted.');
      fireEvent.click(button);
    }
    for (const button of screen.getAllByRole('button', { name: 'Delete mira' })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'You cannot delete your own account.');
    }
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([null, { ...admin, username: 'forged' }])('fails closed when UserRow renders standalone with %j', session => {
    render(<UserRow account={writer} session={session} onDelete={vi.fn()} mobile />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Administrator access is required.')).toBeInTheDocument();
  });
  it('disables standalone row deletion for an authenticated ordinary user', () => {
    saveUsers([writer]);
    const target = { ...writer, id: 'other', username: 'other' };
    render(<UserRow account={target} session={sessionFor(writer)} onDelete={vi.fn()} mobile />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Administrator access is required.')).toBeInTheDocument();
  });
  it('dismisses then accepts account deletion, updates both layouts and retains posts', async () => {
    saveUsers([writer]);
    savePosts([{ id: 'p', authorId: writer.id, authorName: 'Mira' }]);
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page(UserManagement);
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Delete mira' }));
    expect(getUsers()).toEqual([writer]);
    expect(screen.getByRole('heading', { name: 'Accounts (2)' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    await user.click(within(screen.getByRole('article', { name: 'Account mira' })).getByRole('button'));
    expect(getUsers()).toEqual([]);
    expect(screen.queryByText('@mira')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accounts (1)' })).toBeInTheDocument();
    expect(getPosts()).toEqual([{ id: 'p', authorId: writer.id, authorName: 'Mira' }]);
    expect(screen.getByRole('status')).toHaveTextContent('Their posts were retained.');
  });
  it('reports deletion write failure and preserves both row and card', async () => {
    saveUsers([writer]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    page(UserManagement);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Delete mira' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved');
    expect(screen.getAllByText('@mira')).toHaveLength(2);
    expect(getUsers()).toEqual([writer]);
  });
});

describe('dashboard recent posts and counts', () => {
  /** Create deliberately ascending stored order, not already sorted fixtures. */
  function posts() {
    return Array.from({ length: 7 }, (_, index) => ({
      id: `p${index}`, title: `Story ${index}`, content: 'Original', authorId: 'writer', authorName: 'Mira',
      createdAt: `2026-03-0${index + 1}T12:00:00.000Z`,
    }));
  }
  it('shows true empty totals, permanent admin and quick-action destinations', () => {
    page(AdminDashboard);
    for (const [label, value] of [['Total Posts', 0], ['Total Accounts', 1], ['Total Admins', 1], ['Total Writers', 0]]) {
      expect(within(screen.getByRole('region', { name: label })).getByText(String(value))).toBeInTheDocument();
    }
    expect(screen.getByText('No posts yet. Write your first post to begin.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
    expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
  });
  it('shows newest five, author metadata, edit links and updates true totals after accepted deletion', async () => {
    saveUsers([writer, { ...writer, id: 'editor', username: 'editor', role: 'admin' }]);
    savePosts(posts());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    page(AdminDashboard);
    expect(screen.getAllByRole('listitem').map(item => within(item).getByRole('link', { name: /^Story/ }).textContent))
      .toEqual(['Story 6', 'Story 5', 'Story 4', 'Story 3', 'Story 2']);
    expect(screen.getByText('Mira · Mar 07, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Story 6' })).toHaveAttribute('href', '/edit/p6');
    for (const [label, value] of [['Total Posts', 7], ['Total Accounts', 3], ['Total Admins', 2], ['Total Writers', 1]]) {
      expect(within(screen.getByRole('region', { name: label })).getByText(String(value))).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(getPosts()).toHaveLength(7);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(getPosts()).toHaveLength(6);
    expect(screen.queryByRole('link', { name: 'Edit Story 6' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Story 1' })).toHaveAttribute('href', '/edit/p1');
    expect(within(screen.getByRole('region', { name: 'Total Posts' })).getByText('6')).toBeInTheDocument();
  });
  it('retains posts and shows post deletion failure', async () => {
    savePosts(posts());
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    page(AdminDashboard);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved');
    expect(getPosts()).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'Edit Story 6' })).toBeInTheDocument();
  });
  it('shows empty state and zero posts after deleting the last post', async () => {
    savePosts(posts().slice(0, 1));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    page(AdminDashboard);
    await user.click(screen.getByRole('button', { name: 'Delete Story 0' }));
    expect(getPosts()).toEqual([]);
    expect(screen.getByText('No posts yet. Write your first post to begin.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Total Posts' })).getByText('0')).toBeInTheDocument();
  });
  it('renders a numeric StatCard without requiring an icon', () => {
    render(<StatCard label="Total Posts" value={0} />);
    expect(screen.getByRole('region', { name: 'Total Posts' })).toHaveTextContent('0');
  });
});
