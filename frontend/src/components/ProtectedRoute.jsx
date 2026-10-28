/** Gate workspace routes using current account data as well as App's propagated session. */
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import { getSession, validateSession } from '../utils/auth.js';

/** Redirect guests to login and ordinary users away from administrator routes.
 * @param {object} props Optional supplied session, admin-only flag and child route.
 * @returns {JSX.Element} Authorized content or a replace redirect.
 */
export function ProtectedRoute({ session, adminOnly = false, children }) {
  const current = session === undefined ? getSession() : validateSession(session);
  if (!current) return <Navigate to="/login" replace />;
  if (adminOnly && current.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children || <Outlet />;
}

ProtectedRoute.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string, username: PropTypes.string, displayName: PropTypes.string, role: PropTypes.string,
  }),
  adminOnly: PropTypes.bool,
  children: PropTypes.node,
};
