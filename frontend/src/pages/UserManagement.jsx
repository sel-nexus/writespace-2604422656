/** Create and remove demo accounts through administrator-only operations. */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { UserRow } from '../components/UserRow.jsx';
import { sessionType } from '../components/BlogCard.jsx';
import { getAccounts, getSession, validateSession } from '../utils/auth.js';
import { createUser, deleteUser } from '../utils/users.js';
import { ui } from '../utils/styles.js';

/** Guard standalone rendering and keep failed account drafts and deletion errors visible.
 * @param {object} props Candidate identity, defaulting to the persisted session.
 * @returns {JSX.Element} Account form and responsive collection, or access redirect.
 */
export default function UserManagement({ session = getSession() }) {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', role: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const identity = validateSession(session);
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'admin') return <Navigate to="/blogs" replace />;
  const accounts = getAccounts();

  /** Update controlled fields without normalizing the chosen role. */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  /** Save through the service and clear the form only after successful persistence. */
  function submit(event) {
    event.preventDefault();
    setFields({});
    setError('');
    setStatus('');
    try {
      const account = createUser(values, identity);
      setValues({ displayName: '', username: '', password: '', role: '' });
      setStatus(`Account created for ${account.displayName}.`);
    } catch (failure) {
      setFields(failure.fields || {});
      setError(failure.fields ? '' : failure.message);
    }
  }

  /** Confirm deletion without erasing historical posts or pretending failed writes succeeded. */
  function remove(id) {
    setError('');
    setStatus('');
    const account = accounts.find(item => item.id === id);
    if (!window.confirm(`Delete account @${account.username}? Their posts will be retained.`)) return;
    try {
      deleteUser(id, identity);
      setStatus(`Account @${account.username} deleted. Their posts were retained.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className={`${ui.page} space-y-8`}>
      <header className="space-y-3">
        <h1 className={ui.heading}>Manage Users</h1>
        <p className="text-stone-600">Create local accounts and keep your writing community organized.</p>
      </header>
      <form onSubmit={submit} noValidate aria-labelledby="create-user-heading" className={`${ui.card} space-y-6`}>
        <h2 id="create-user-heading" className="font-[Georgia] text-2xl">Create User</h2>
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Demo only: passwords are stored as plaintext in this browser. Do not use real passwords or sensitive data.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <Field
            id="user-name" label="Display Name" name="displayName" value={values.displayName}
            onChange={change} error={fields.displayName} required
          />
          <Field
            id="user-username" label="Username" name="username" value={values.username}
            onChange={change} error={fields.username} autoComplete="off" required
          />
          <Field
            id="user-password" label="Password" name="password" type="password" value={values.password}
            onChange={change} error={fields.password} autoComplete="new-password" required
          />
          <div className="space-y-2">
            <label htmlFor="user-role" className="block font-semibold">Role</label>
            <select
              id="user-role" name="role" value={values.role} onChange={change} className={ui.input}
              required aria-required="true" aria-invalid={Boolean(fields.role)}
              aria-describedby={fields.role ? 'user-role-error' : undefined}
            >
              <option value="">Choose a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {fields.role && <p id="user-role-error" role="alert" className="text-red-700">{fields.role}</p>}
          </div>
        </div>
        <button type="submit" className={ui.primary}>Create User</button>
      </form>
      {error && <p role="alert" className={ui.error}>{error}</p>}
      <p role="status" className="text-teal-800">{status}</p>
      <section aria-labelledby="accounts-heading" className="space-y-4">
        <h2 id="accounts-heading" className="font-[Georgia] text-2xl">Accounts ({accounts.length})</h2>
        <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white sm:block">
          <table aria-label="User accounts" className="w-full text-left">
            <thead className="bg-stone-100 text-sm text-stone-600">
              <tr>
                <th scope="col" className="p-4">Name / Username</th>
                <th scope="col" className="p-4">Role</th>
                <th scope="col" className="p-4">Created</th>
                <th scope="col" className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => <UserRow key={account.id} account={account} session={identity} onDelete={remove} />)}
            </tbody>
          </table>
        </div>
        <div aria-label="User account cards" className="space-y-4 sm:hidden">
          {accounts.map(account => (
            <UserRow key={account.id} account={account} session={identity} onDelete={remove} mobile />
          ))}
        </div>
      </section>
    </main>
  );
}

UserManagement.propTypes = { session: sessionType };
