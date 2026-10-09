import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { confirmEmail } from '../../api/recruitmentApi';

/**
 * Landing page for the link in the verification email. The link carries userId
 * and token as query parameters; this exchanges them for a confirmed address.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const token = params.get('token');

  // A malformed link is knowable during render, so it is derived rather than
  // pushed into state from the effect.
  const linkIsComplete = Boolean(userId && token);

  const [state, setState] = useState(linkIsComplete ? 'working' : 'failed');
  const [message, setMessage] = useState(
    linkIsComplete ? '' : 'This link is missing information. Request a new verification email.');

  useEffect(() => {
    if (!linkIsComplete) return undefined;

    let active = true;

    confirmEmail({ userId, token })
      .then(() => {
        if (active) {
          setState('confirmed');
          setMessage('Your email address is confirmed. You can now sign in and apply.');
        }
      })
      .catch((err) => {
        if (active) {
          setState('failed');
          setMessage(err.message ?? 'The confirmation link is invalid or has expired.');
        }
      });

    return () => { active = false; };
  }, [userId, token, linkIsComplete]);

  return (
    <div className="w-full mt-16 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center">
      {state === 'working' && (
        <>
          <Loader2 size={32} className="mb-4 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-slate-600 dark:text-slate-300">Confirming your email address…</p>
        </>
      )}

      {state === 'confirmed' && (
        <>
          <CheckCircle2 size={32} className="mb-4 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Email confirmed</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
          <Link
            to="/login"
            className="inline-block mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Sign in
          </Link>
        </>
      )}

      {state === 'failed' && (
        <>
          <XCircle size={32} className="mb-4 text-red-600 dark:text-red-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Confirmation failed</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
          <Link
            to="/register"
            className="inline-block mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to registration
          </Link>
        </>
      )}
    </div>
  );
}
