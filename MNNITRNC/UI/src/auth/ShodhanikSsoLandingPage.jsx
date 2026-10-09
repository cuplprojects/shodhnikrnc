import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useTheme } from '../layout/useTheme';
import { ApiError } from '../api/apiClient';
import { Loader2, AlertTriangle } from 'lucide-react';

/**
 * Where the gateway sends a Shodhanik Supervisor after SSO -- see the
 * Shodhanik-x-RNC integration plan, §2/§9.2. The Shodhanik-issued JWT arrives
 * as a `token` query param (the gateway's own concern; this page only reads
 * it). loginFederated exchanges it for an RNC-native token via
 * AuthController.RegisterFacultyFederated, which both accounts link and
 * first-time arrivals alike go through -- ProtectedRoute then routes a
 * Pending-only result to /registration-pending on its own, so this page
 * never has to know Pending from Active itself.
 */
export default function ShodhanikSsoLandingPage() {
  useTheme();
  const [searchParams] = useSearchParams();
  const { loginFederated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in development; without this guard
    // the exchange (and its account-creation side effect) would fire twice.
    if (attempted.current) return;
    attempted.current = true;

    const shodhanikToken = searchParams.get('token');
    if (!shodhanikToken) {
      // Deferred like the rejection branch below, rather than called inline:
      // an effect body should update external systems or subscribe, not set
      // state synchronously on its own first run.
      queueMicrotask(() => setError('No sign-in information was provided. Please return to Shodhanik and try again.'));
      return;
    }

    loginFederated(shodhanikToken)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError('This sign-in link is not a recognised Shodhanik Supervisor session. Please return to Shodhanik and try again.');
        } else if (err instanceof ApiError && err.status === 409) {
          setError(err.message);
        } else {
          setError('Unable to complete sign-in right now. Please try again, or contact the R&C office if this continues.');
        }
      });
  }, [searchParams, loginFederated, navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] dark:bg-[#030712] px-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
        {error ? (
          <>
            <div className="h-16 w-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <AlertTriangle size={28} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Sign-in failed</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{error}</p>
            </div>
          </>
        ) : (
          <>
            <div className="h-16 w-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Loader2 size={28} className="text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Signing you in</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                Linking your Shodhanik account to the R&amp;C portal…
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
