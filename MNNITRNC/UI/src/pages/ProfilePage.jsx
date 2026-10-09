import { useEffect, useState } from 'react';
import { getMyProfile } from '../api/myProfileApi';
import { changePassword } from '../api/authApi';
import { ApiError } from '../api/apiClient';
import { useAuth } from '../auth/useAuth';
import FacultyProfileForm from '../components/FacultyProfileForm';
import { Shield, Key, User } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMyProfile()
      .then((data) => { if (mounted) setProfile(data); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleSaved = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : 'Failed to change password. Please try again.'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-2xl">
            <User size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{user?.fullName}</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {user?.roles?.join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Editable Profile Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Professional Details</h2>

            {savedMessage && (
              <div className="p-3 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                Profile saved.
              </div>
            )}

            <FacultyProfileForm initialProfile={profile} email={profile?.email} roles={user?.roles || []} onSaved={handleSaved} />
          </div>
        </div>

        {/* Right Column: Roles & Security */}
        <div className="space-y-6">
          {/* Roles & Permissions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Shield className="text-blue-500" size={22} />
              Access Roles
            </h2>
            <div className="flex flex-col gap-3">
              {user?.roles?.length > 0 ? (
                user.roles.map(role => (
                  <div key={role} className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{role}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">Faculty</span>
                </div>
              )}
            </div>
          </div>

          {/* Security */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Key className="text-rose-500" size={22} />
              Security
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Account Password</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">It's a good idea to use a strong password that you're not using elsewhere.</p>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  {passwordError && (
                    <div className="p-3 text-xs text-red-800 rounded-lg bg-red-50 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                      {passwordError}
                    </div>
                  )}
                  {passwordSaved && (
                    <div className="p-3 text-xs text-green-800 rounded-lg bg-green-50 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                      Password changed.
                    </div>
                  )}
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all dark:text-white"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min. 8 characters)"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all dark:text-white"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors"
                  >
                    <Key size={16} />
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
