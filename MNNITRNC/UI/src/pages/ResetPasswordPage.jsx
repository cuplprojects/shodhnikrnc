import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { resetPassword } from '../api/authApi';

/**
 * Landing page for the link in the "forgot password" email. The link carries
 * userId and token as query parameters; the visitor picks a new password here
 * and it is exchanged for those together in one call.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const token = params.get('token');
  const linkIsComplete = Boolean(userId && token);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState(linkIsComplete ? 'form' : 'failed');
  const [message, setMessage] = useState(
    linkIsComplete ? '' : 'This link is missing information. Request a new one from the sign-in page.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      await resetPassword(userId, token, newPassword);
      setState('done');
    } catch (err) {
      setState('failed');
      setMessage(err.message ?? 'This reset link is invalid or has expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full mt-16 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center">
      {state === 'form' && (
        <>
          <KeyRound size={32} className="mb-4 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Choose a new password</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            {message && (
              <div className="p-3 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                {message}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Confirm new password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        </>
      )}

      {state === 'done' && (
        <>
          <CheckCircle2 size={32} className="mb-4 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Password reset</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your password has been changed. You can now sign in with your new password.
          </p>
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
          <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Reset failed</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
          <Link
            to="/login"
            className="inline-block mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
