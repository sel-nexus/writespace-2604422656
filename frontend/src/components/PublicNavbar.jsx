/** Present public entry points and a role-aware return to the local workspace. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen, Crown, List, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { ui } from '../utils/styles.js';

/** Render guest navigation or the supplied account chip without reading authentication storage.
 * Args:
 *   session: Validated account supplied by the route owner, or null for a guest.
 * Returns:
 *   Sticky navigation with accessible mobile disclosure.
 */
export function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  const home = session?.role === 'admin' ? '/admin' : '/blogs';
  const RoleIcon = session?.role === 'admin' ? Crown : BookOpen;

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 md:px-8">
        <Link to="/" className={`${ui.ghost} gap-2 px-0 font-[Georgia] text-xl font-bold text-stone-900`}>
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          WriteSpace
        </Link>
        <button
          type="button"
          className={`${ui.ghost} ml-auto px-3 sm:hidden`}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="public-links"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={24} aria-hidden="true" />
          ) : (
            <List size={24} aria-hidden="true" />
          )}
        </button>
        <div
          id="public-links"
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-3 sm:ml-auto sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {session ? (
            <>
              <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                <span className="rounded-full bg-teal-100 p-2 text-teal-800">
                  <RoleIcon size={20} weight="bold" aria-hidden="true" />
                </span>
                <span className="max-w-48 truncate">{session.displayName}</span>
              </span>
              <Link to={home} className={ui.primary} onClick={() => setOpen(false)}>
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={ui.ghost} onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link to="/register" className={ui.primary} onClick={() => setOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
