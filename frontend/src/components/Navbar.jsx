/** Present the persistent authenticated workspace shell with mobile and account disclosures. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen, CaretDown, List, X } from '@phosphor-icons/react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { ui } from '../utils/styles.js';

/** Render role links, a keyboard-accessible disclosure and a failure-aware logout action.
 * @param {object} props Validated session and App-owned logout callback.
 * @returns {JSX.Element} Sticky authenticated navigation.
 */
export function Navbar({ session, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const links = [['All Blogs', '/blogs'], ['Write', '/write']];
  if (session.role === 'admin') links.push(['Users', '/users'], ['Admin Dashboard', '/admin']);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  /** Close the session only after persistence succeeds, keeping failures visible. */
  function handleLogout() {
    try {
      onLogout();
      setError('');
      setAccountOpen(false);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
      <nav aria-label="Workspace navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 md:px-8">
        <Link to="/" className={`${ui.ghost} gap-2 px-0 font-[Georgia] text-xl font-bold text-stone-900`}>
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          WriteSpace
        </Link>
        <button
          type="button"
          className={`${ui.ghost} ml-auto px-3 sm:hidden`}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="workspace-links"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
        </button>
        <div
          id="workspace-links"
          className={`${mobileOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {links.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `${ui.ghost} ${isActive ? 'bg-teal-100 font-semibold text-teal-900' : ''}`}
            >
              {label}
            </NavLink>
          ))}
          <div className="relative" onKeyDown={event => { if (event.key === 'Escape') setAccountOpen(false); }}>
            <button
              type="button"
              className={`${ui.ghost} w-full gap-2 px-3`}
              aria-label={`Account: ${session.displayName}`}
              aria-expanded={accountOpen}
              aria-controls="account-actions"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <Avatar role={session.role} />
              <span className="max-w-40 truncate">{session.displayName}</span>
              <CaretDown size={16} aria-hidden="true" />
            </button>
            {accountOpen && (
              <div id="account-actions" className="absolute right-0 z-30 min-w-48 rounded-2xl border border-stone-200 bg-white p-2 shadow-lg">
                <p className="px-4 py-2 text-sm text-stone-600">Signed in as {session.username}</p>
                <button type="button" className={`${ui.ghost} w-full`} onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {error && (
        <p role="alert" className={`${ui.error} mx-auto max-w-6xl`}>{error}</p>
      )}
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
};
