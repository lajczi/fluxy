import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const GuildSelector = lazy(() => import('./pages/GuildSelector').then((m) => ({ default: m.GuildSelector })));
const GuildSettings = lazy(() => import('./pages/GuildSettings').then((m) => ({ default: m.GuildSettings })));
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const Health = lazy(() => import('./pages/Health').then((m) => ({ default: m.Health })));
const MyData = lazy(() => import('./pages/MyData').then((m) => ({ default: m.MyData })));
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

function ProtectedRoute({ children, ownerOnly = false }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (ownerOnly && !user?.isOwner) return <Navigate to="/guilds" />;

  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (MOCK_MODE) return <Navigate to="/guilds/mock" replace />;
  if (user?.isOwner)
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
          <Dashboard />
        </Suspense>
      </ErrorBoundary>
    );
  return <Navigate to="/guilds" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/guilds"
          element={
            <ErrorBoundary>
              <Suspense fallback={<PageSpinner />}>
                <GuildSelector />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/guilds/:guildId/*"
          element={
            <ErrorBoundary>
              <Suspense fallback={<PageSpinner />}>
                <GuildSettings />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute ownerOnly>
              <ErrorBoundary>
                <Suspense fallback={<PageSpinner />}>
                  <Stats />
                </Suspense>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/health"
          element={
            <ProtectedRoute ownerOnly>
              <ErrorBoundary>
                <Suspense fallback={<PageSpinner />}>
                  <Health />
                </Suspense>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-data"
          element={
            <ErrorBoundary>
              <Suspense fallback={<PageSpinner />}>
                <MyData />
              </Suspense>
            </ErrorBoundary>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/guilds" />} />
    </Routes>
  );
}
