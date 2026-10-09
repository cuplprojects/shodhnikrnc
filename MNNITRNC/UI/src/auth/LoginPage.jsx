import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ApiError } from '../api/apiClient';
import { useTheme } from '../layout/useTheme';
import { register, resendVerification, forgotPassword } from '../api/authApi';
import { registerFaculty } from '../api/facultyRegistrationApi';
import { listActiveDepartments } from '../api/departmentsApi';
import { Sun, Moon, Mail, Lock, ArrowRight, Fingerprint, Users, Briefcase, GraduationCap, Eye, EyeOff, BookOpen } from 'lucide-react';

// Cosmetic only -- the backend authenticates by username/password alone and
// does not know or care which of these a caller picked (see AuthContext's
// login(), which never sends loginType). This just picks the right label,
// accent colour and copy for who is actually sitting at the form: staff sign
// in with a username, applicants registered via /register with an email.
const LOGIN_TYPES = {
  faculty: {
    label: 'Faculty', icon: Users, fieldLabel: 'Faculty Username', fieldType: 'text',
    accent: 'blue', ring: 'focus:ring-blue-600/50', text: 'text-blue-600 dark:text-blue-400',
    button: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/20',
    submitLabel: 'Faculty Sign In',
  },
  office: {
    label: 'Office', icon: Briefcase, fieldLabel: 'Office Username', fieldType: 'text',
    accent: 'purple', ring: 'focus:ring-purple-600/50', text: 'text-purple-600 dark:text-purple-400',
    button: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 shadow-purple-600/20',
    submitLabel: 'Office Sign In',
  },
  candidate: {
    label: 'Candidate', icon: GraduationCap, fieldLabel: 'Candidate Email', fieldType: 'email',
    accent: 'emerald', ring: 'focus:ring-emerald-600/50', text: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20',
    submitLabel: 'Candidate Sign In',
  },
};

export default function LoginPage({ defaultIsRegistering = false }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showFacRegPassword, setShowFacRegPassword] = useState(false);
  const [loginType, setLoginType] = useState('faculty'); // 'faculty' | 'office' | 'candidate'
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const current = LOGIN_TYPES[loginType];

  // Registration Mode States
  const [isRegistering, setIsRegistering] = useState(defaultIsRegistering);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regResult, setRegResult] = useState(null);
  const [resent, setResent] = useState(false);

  // Forgot Password Mode States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Faculty Registration Mode State (separate fields from Candidate
  // registration -- Faculty registration also collects Department, and posts
  // to a different endpoint; see registerFaculty in facultyRegistrationApi.js).
  const [facRegName, setFacRegName] = useState('');
  const [facRegEmail, setFacRegEmail] = useState('');
  const [facRegPassword, setFacRegPassword] = useState('');
  const [facRegDepartmentId, setFacRegDepartmentId] = useState('');
  const [facRegResult, setFacRegResult] = useState(null);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (loginType === 'faculty' && isRegistering && departments.length === 0) {
      listActiveDepartments().then(setDepartments).catch(() => setDepartments([]));
    }
  }, [loginType, isRegistering, departments.length]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(userName, password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect username or password. Please try again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Your account is not yet verified or has been suspended. Please check your email.');
      } else {
        setError('Unable to sign in right now. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await register(regEmail, regName, regPassword);
      setRegResult(res);
    } catch (err) {
      setError(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacultyRegisterSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await registerFaculty(facRegName, facRegEmail, facRegPassword, facRegDepartmentId);
      setFacRegResult(res);
    } catch (err) {
      setError(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification(regEmail);
      setResent(true);
    } catch {
      setResent(true);
    }
  };

  const handleForgotPasswordSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await forgotPassword(forgotEmail);
    } catch {
      // Deliberately swallowed: the backend always returns 202 whether or not
      // the address exists, so the UI shows the same generic message either way.
    } finally {
      setForgotSent(true);
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full relative flex items-center justify-center bg-[#F8FAFC] dark:bg-[#030712] transition-colors duration-700 overflow-hidden font-sans"
      style={{
        backgroundImage: "url('/images/C1.jpeg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      
      {/* --- Overlay & Mesmerizing Animated Background --- */}
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 dark:bg-blue-900/40 blur-[120px] mix-blend-normal animate-float"></div>
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 dark:bg-purple-900/40 blur-[120px] mix-blend-normal animate-float-delayed"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-cyan-500/20 dark:bg-cyan-900/40 blur-[120px] mix-blend-normal animate-float"></div>
      </div>

      {/* Theme Toggle & User Manual */}
      <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
        <Link
          to="/manual"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200 hover:scale-105 hover:bg-white/70 dark:hover:bg-white/10 active:scale-95 transition-all duration-300"
        >
          <BookOpen size={18} strokeWidth={2.5} />
          <span className="hidden sm:inline">User Manual</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm text-slate-700 dark:text-slate-300 hover:scale-110 active:scale-95 transition-all duration-300"
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
        </button>
      </div>

      {/* --- Premium Glassmorphic Login/Register Card --- */}
      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Branding header above card */}
        <div className="flex flex-col items-center justify-center mb-8 drop-shadow-lg">
          <div className="h-32 w-32 mb-4 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full shadow-xl border border-white/40 dark:border-slate-700 overflow-hidden">
            <img src="/images/MNNIT_LOGO.png" alt="MNNIT Logo" className="h-28 w-28 object-contain drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md text-center">
            MNNIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 drop-shadow-none">R&C</span> Portal
          </h1>
          <p className="text-sm font-bold text-slate-200 mt-2 tracking-wide uppercase text-center drop-shadow-md">
            Research & Consultancy
          </p>
        </div>

        {/* The Card */}
        <div className="bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-black/20 rounded-3xl p-8 relative overflow-hidden">
          
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 dark:via-white/20 to-transparent"></div>

          {isForgotPassword ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Reset your password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-semibold leading-relaxed">
                  Enter your account email and we'll send you a link to choose a new password.
                </p>
              </div>

              {forgotSent ? (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <h3 className="font-bold text-blue-800 dark:text-blue-400 text-sm mb-1">Check your email</h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                      If an account exists for that address, we've sent a link to reset your password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-600/20 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Email address *</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="name@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-600/20 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none group mt-6"
                  >
                    {isSubmitting ? 'Sending...' : 'Send reset link'}
                  </button>

                  <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Back to Sign In
                    </button>
                  </p>
                </form>
              )}
            </div>
          ) : !isRegistering ? (
            <>
              {/* Login Type Segmented Control */}
              <div className="flex bg-slate-200/50 dark:bg-black/30 rounded-xl p-1 mb-8 shadow-inner border border-slate-300/30 dark:border-white/5">
                {Object.entries(LOGIN_TYPES).map(([key, type]) => {
                  const Icon = type.icon;
                  const isActive = loginType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLoginType(key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                        isActive
                          ? `bg-white dark:bg-slate-800 ${type.text} shadow-sm`
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      {type.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-4">
                  {/* Username / Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                      {current.fieldLabel}
                    </label>
                    <div className="relative group">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:${current.text}`}>
                        <Mail size={18} strokeWidth={2.5} />
                      </div>
                      <input
                        type={current.fieldType}
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className={`w-full pl-11 pr-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium ${current.ring}`}
                        placeholder={loginType === 'candidate' ? 'Enter registered email' : 'Enter username'}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password</label>
                    </div>
                    <div className="relative group">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 transition-colors group-focus-within:${current.text}`}>
                        <Lock size={18} strokeWidth={2.5} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-11 pr-12 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium tracking-widest ${current.ring}`}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-md p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                    <Fingerprint size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full relative flex items-center justify-center gap-2 py-4 px-6 font-bold text-white rounded-2xl shadow-xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none group mt-8 ${current.button}`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>{current.submitLabel}</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                {(loginType === 'candidate' || loginType === 'faculty') && (
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => { setError(null); setIsRegistering(true); }}
                      className={`font-semibold ${loginType === 'faculty' ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'}`}
                    >
                      {loginType === 'faculty' ? 'Register as Faculty' : 'Register to apply'}
                    </button>
                  </p>
                )}
              </form>
            </>
          ) : loginType === 'faculty' ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Register as Faculty</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-semibold leading-relaxed">
                  You can sign in right after registering. Your HOD or the R&amp;C office will
                  review your account before you get full access.
                </p>
              </div>

              {facRegResult ? (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <h3 className="font-bold text-blue-800 dark:text-blue-400 text-sm mb-1">
                      {facRegResult.alreadyRegistered ? 'Account already exists' : 'Registration received'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                      {facRegResult.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFacRegResult(null); setIsRegistering(false); }}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-600/20 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleFacultyRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Full name *</label>
                    <input
                      type="text"
                      required
                      value={facRegName}
                      onChange={(e) => setFacRegName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Email address *</label>
                    <input
                      type="email"
                      required
                      value={facRegEmail}
                      onChange={(e) => setFacRegEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="name@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Department *</label>
                    <select
                      required
                      value={facRegDepartmentId}
                      onChange={(e) => setFacRegDepartmentId(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:bg-white dark:focus:bg-black/40 transition-all font-medium"
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Password *</label>
                    <div className="relative">
                      <input
                        type={showFacRegPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={facRegPassword}
                        onChange={(e) => setFacRegPassword(e.target.value)}
                        className="w-full px-4 pr-12 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium tracking-widest"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFacRegPassword(!showFacRegPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showFacRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 ml-1">At least 8 characters.</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-md p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                      <Fingerprint size={18} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-600/20 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none group mt-6"
                  >
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </button>

                  <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Register to apply</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-semibold leading-relaxed">
                  You will need to confirm your email address before you can apply for a position. One account covers every project you apply to.
                </p>
              </div>

              {regResult ? (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm mb-1">
                      {regResult.alreadyRegistered ? 'Account already exists' : 'Check your email'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                      {regResult.message}
                    </p>
                  </div>

                  {!regResult.alreadyRegistered && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resent}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:text-slate-400"
                    >
                      {resent ? 'Verification email re-sent' : 'Resend the verification email'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setRegResult(null); setIsRegistering(false); }}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/20 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Full name *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="Enter full name"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Email address *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium"
                      placeholder="name@example.com"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Password *</label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-4 pr-12 py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:bg-white dark:focus:bg-black/40 transition-all placeholder:text-slate-400 font-medium tracking-widest"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 ml-1">At least 8 characters.</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-md p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                      <Fingerprint size={18} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-600/20 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none group mt-6"
                  >
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </button>

                  <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex justify-center items-center gap-6 text-sm font-bold text-white drop-shadow-md">
          <button
            type="button"
            onClick={() => { setError(null); setIsForgotPassword(true); }}
            className="hover:text-blue-200 transition-colors"
          >
            Forgot Password?
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-white/60 drop-shadow-none"></div>
          <a href="#" className="hover:text-blue-200 transition-colors">Contact Support</a>
        </div>
      </div>
    </div>
  );
}

