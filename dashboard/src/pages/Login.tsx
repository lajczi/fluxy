import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Navigate, Link } from 'react-router-dom';

export function Login() {
  const { isAuthenticated, loading, login } = useAuth();
  const [accepted, setAccepted] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" />;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--background))]">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-4">
          <img src="/bot-icon.png" alt="Fluxy" className="h-16 w-16 mx-auto rounded-2xl" />
          <h1 className="text-3xl font-bold text-white">Fluxy Dashboard</h1>
          <p className="text-gray-400">Manage your bot settings and configure your servers.</p>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-transparent text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-gray-400">
              I agree to the{' '}
              <Link to="/terms" className="text-blue-400 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-blue-400 hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            onClick={login}
            disabled={!accepted}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.97] active:bg-blue-800 text-white font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:shadow-none disabled:active:scale-100"
          >
            Login with Fluxer
          </button>
        </div>

        <div className="text-center text-xs text-gray-500">
          <Link to="/privacy" className="hover:text-gray-300">
            Privacy Policy
          </Link>
          <span className="mx-2">-</span>
          <Link to="/terms" className="hover:text-gray-300">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
