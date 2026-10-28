/** Own public discovery, identity state and guarded workspace route wiring. */
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';
import { clearSession, getSession, roleHome, validateSession } from './utils/auth.js';

/** Propagate identity through callbacks without adding a second router or Context.
 * Returns:
 *   Public, identity, post and administrator pages with guarded workspace routes.
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
          <Route path="/blogs" element={<Home session={activeSession} />} />
          <Route path="/blog/:id" element={<ReadBlog session={activeSession} />} />
          <Route path="/write" element={<WriteBlog session={activeSession} />} />
          <Route path="/edit/:id" element={<WriteBlog session={activeSession} />} />
        </Route>
        <Route element={<ProtectedRoute session={activeSession} adminOnly />}>
          <Route path="/admin" element={<AdminDashboard session={activeSession} />} />
          <Route path="/users" element={<UserManagement session={activeSession} />} />
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
