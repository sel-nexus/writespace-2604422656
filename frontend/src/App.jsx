/** Own public discovery, identity state and guarded workspace route wiring. */
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import { clearSession, getSession, roleHome, validateSession } from './utils/auth.js';

/** Propagate identity through callbacks without adding a second router or Context.
 * Returns:
 *   Public and identity pages plus guarded redirects for future workspace routes.
 */
export default function App() {
  const [session, setCurrentSession] = useState(getSession);
  const location = useLocation();
  const navigate = useNavigate();
  const activeSession = validateSession(session);

  /** Refresh shared identity after successful login or registration. */
  function authenticated(nextSession) {
    setCurrentSession(nextSession);
    navigate(roleHome(nextSession), { replace: true });
  }

  /** Clear persisted identity before returning to public discovery. */
  function logout() {
    clearSession();
    setCurrentSession(null);
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-[100dvh] bg-stone-50 font-['Trebuchet_MS',sans-serif] text-stone-900">
      {location.pathname === '/' || !activeSession ? (
        <PublicNavbar session={activeSession} />
      ) : (
        <Navbar session={activeSession} onLogout={logout} />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage session={activeSession} />
          }
        />
        <Route path="/login" element={<LoginPage session={activeSession} onAuthenticated={authenticated} />} />
        <Route path="/register" element={<RegisterPage session={activeSession} onAuthenticated={authenticated} />} />
        <Route element={<ProtectedRoute session={activeSession} />}>
          <Route path="/blogs" element={<Navigate to="/" replace />} />
          <Route path="/blog/:id" element={<Navigate to="/" replace />} />
          <Route path="/write" element={<Navigate to="/" replace />} />
          <Route path="/edit/:id" element={<Navigate to="/" replace />} />
        </Route>
        <Route element={<ProtectedRoute session={activeSession} adminOnly />}>
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/users" element={<Navigate to="/" replace />} />
        </Route>
        <Route
          path="*"
          element={
            <Navigate to="/" replace />
          }
        />
      </Routes>
    </div>
  );
}
