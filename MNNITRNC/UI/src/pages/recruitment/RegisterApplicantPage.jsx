import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, MailCheck, Info } from 'lucide-react';
import { registerApplicant, resendVerification } from '../../api/recruitmentApi';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

/**
 * Applicant self-registration.
 *
 * The account is created immediately but cannot apply until the email address is
 * confirmed, so the success state says so plainly rather than implying the
 * applicant is ready to go.
 */
export default function RegisterApplicantPage() {
  const [formData, setFormData] = useState({ email: '', fullName: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [resent, setResent] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      setResult(await registerApplicant(formData));
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification(formData.email);
      setResent(true);
    } catch {
      // Resend is deliberately silent server-side; surfacing a failure here
      // would leak whether the address exists.
      setResent(true);
    }
  };

  if (result) {
    return (
      <div className="w-full mt-16 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <MailCheck size={24} className="text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            {result.alreadyRegistered ? 'Account already exists' : 'Check your email'}
          </h1>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">{result.message}</p>

        {!result.alreadyRegistered && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resent}
            className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:text-slate-400"
          >
            {resent ? 'Verification email re-sent' : 'Resend the verification email'}
          </button>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Link to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-16 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus size={24} className="text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Register to apply</h1>
      </div>

      <div className="flex items-start gap-2 mb-6 text-xs text-slate-500 dark:text-slate-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          You will need to confirm your email address before you can apply for a
          position. One account covers every project you apply to.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className={LABEL_CLASS} htmlFor="fullName">Full name <span className="text-red-500">*</span></label>
          <input required id="fullName" name="fullName" type="text"
            value={formData.fullName} onChange={handleChange} className={FIELD_CLASS} />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS} htmlFor="email">Email address <span className="text-red-500">*</span></label>
          <input required id="email" name="email" type="email"
            value={formData.email} onChange={handleChange} className={FIELD_CLASS} />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS} htmlFor="password">Password <span className="text-red-500">*</span></label>
          <input required id="password" name="password" type="password" minLength={8}
            value={formData.password} onChange={handleChange} className={FIELD_CLASS} />
          <p className="text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-sm transition-all"
        >
          {isSubmitting ? 'Registering…' : 'Register'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Sign in
        </Link>
      </div>
    </div>
  );
}
