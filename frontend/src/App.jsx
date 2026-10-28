/** Own the initial public route; identity and protected routes are wired by later slices. */
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import LandingPage from './pages/LandingPage.jsx';

/** Render guest discovery and redirect unknown paths to the public home.
 * Returns:
 *   The initial public route tree, without a second router or authentication dependency.
 */
export default function App() {
  return (
    <div className="min-h-[100dvh] bg-stone-50 font-['Trebuchet_MS',sans-serif] text-stone-900">
      <PublicNavbar session={null} />
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage session={null} />
          }
        />
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
