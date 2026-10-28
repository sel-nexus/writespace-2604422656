/** Offer browser-local demo login with field-associated errors and no-real-password guidance. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen } from '@phosphor-icons/react';
import { Link, Navigate } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { login, roleHome } from '../utils/auth.js';
import { ui } from '../utils/styles.js';

/** Submit demo credentials and notify App after persistence succeeds.
 * @param {object} props Current session and shared authentication callback.
 * @returns {JSX.Element} Login form or authenticated role-home redirect.
 */
export default function LoginPage({ session = null, onAuthenticated }) {
  const [values, setValues] = useState({ username: '', password: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  if (session) return <Navigate to={roleHome(session)} replace />;

  /** Keep each input controlled without discarding focus. */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  /** Show validation or persistence failures without navigating away. */
  function submit(event) {
    event.preventDefault();
    setFields({});
    setError('');
    try {
      onAuthenticated(login(values.username, values.password));
    } catch (failure) {
      setFields(failure.fields || {});
      setError(failure.fields ? '' : failure.message);
    }
  }

  return (
    <main className={`${ui.page} flex min-h-[80dvh] items-center justify-center`}>
      <section className={`${ui.card} w-full max-w-md space-y-6`} aria-labelledby="login-title">
        <Link to="/" className="inline-flex items-center gap-2 font-[Georgia] text-xl text-teal-800">
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          WriteSpace
        </Link>
        <div className="space-y-2">
          <h1 id="login-title" className={ui.heading}>Welcome back</h1>
          <p className="text-stone-600">Log in to your local writing workspace.</p>
        </div>
        <p className="rounded-xl bg-stone-100 p-4 text-sm leading-relaxed text-stone-700">
          Local demo only. Passwords are stored in plaintext in this browser. Do not use real passwords.
          {' '}Demo administrator: username <strong>admin</strong>, password <strong>admin</strong>.
        </p>
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field
            id="login-username" label="Username" name="username" autoComplete="username"
            value={values.username} onChange={change} error={fields.username} required
          />
          <Field
            id="login-password" label="Password" name="password" type="password" autoComplete="current-password"
            value={values.password} onChange={change} error={fields.password} required
          />
          {error && (
            <p role="alert" className={ui.error}>{error}</p>
          )}
          <button type="submit" className={`${ui.primary} w-full`}>Login</button>
        </form>
        <p className="text-sm text-stone-600">
          New to WriteSpace?{' '}
          <Link to="/register" className="font-semibold text-teal-800 underline underline-offset-4">Register</Link>
        </p>
      </section>
    </main>
  );
}

LoginPage.propTypes = {
  session: PropTypes.shape({ role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  onAuthenticated: PropTypes.func.isRequired,
};
