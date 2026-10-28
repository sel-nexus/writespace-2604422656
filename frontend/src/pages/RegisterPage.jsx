/** Register an ordinary browser-local writer with explicit plaintext-demo guidance. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen } from '@phosphor-icons/react';
import { Link, Navigate } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { register, roleHome } from '../utils/auth.js';
import { ui } from '../utils/styles.js';

/** Validate registration and propagate the newly saved session to App.
 * @param {object} props Current session and shared authentication callback.
 * @returns {JSX.Element} Registration form or authenticated role-home redirect.
 */
export default function RegisterPage({ session = null, onAuthenticated }) {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  if (session) return <Navigate to={roleHome(session)} replace />;

  /** Preserve controlled field values while editing. */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  /** Persist a valid user or associate each rejected field with its error. */
  function submit(event) {
    event.preventDefault();
    setFields({});
    setError('');
    try {
      onAuthenticated(register(values));
    } catch (failure) {
      setFields(failure.fields || {});
      setError(failure.fields ? '' : failure.message);
    }
  }

  return (
    <main className={`${ui.page} flex min-h-[80dvh] items-center justify-center`}>
      <section className={`${ui.card} w-full max-w-md space-y-6`} aria-labelledby="register-title">
        <Link to="/" className="inline-flex items-center gap-2 font-[Georgia] text-xl text-teal-800">
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          WriteSpace
        </Link>
        <div className="space-y-2">
          <h1 id="register-title" className={ui.heading}>Create your account</h1>
          <p className="text-stone-600">A little space for your next big thought.</p>
        </div>
        <p className="rounded-xl bg-stone-100 p-4 text-sm leading-relaxed text-stone-700">
          Local demo only. Passwords are stored in plaintext in this browser. Do not use real passwords.
          Your account and writing stay in this browser, not across devices.
        </p>
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field
            id="register-display-name" label="Display Name" name="displayName" autoComplete="nickname"
            value={values.displayName} onChange={change} error={fields.displayName} required
          />
          <Field
            id="register-username" label="Username" name="username" autoComplete="username"
            value={values.username} onChange={change} error={fields.username} required
          />
          <Field
            id="register-password" label="Password" name="password" type="password" autoComplete="new-password"
            value={values.password} onChange={change} error={fields.password} required
          />
          <Field
            id="register-confirm-password" label="Confirm Password" name="confirmPassword" type="password"
            autoComplete="new-password" value={values.confirmPassword} onChange={change} error={fields.confirmPassword} required
          />
          {error && (
            <p role="alert" className={ui.error}>{error}</p>
          )}
          <button type="submit" className={`${ui.primary} w-full`}>Register</button>
        </form>
        <p className="text-sm text-stone-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-800 underline underline-offset-4">Login</Link>
        </p>
      </section>
    </main>
  );
}

RegisterPage.propTypes = {
  session: PropTypes.shape({ role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  onAuthenticated: PropTypes.func.isRequired,
};
