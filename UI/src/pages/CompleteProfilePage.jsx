import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile } from '../api/myProfileApi';
import { useAuth } from '../auth/useAuth';
import FacultyProfileForm from '../components/FacultyProfileForm';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, markProfileComplete } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getMyProfile()
      .then((data) => { if (mounted) setProfile(data); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleSaved = () => {
    markProfileComplete();
    navigate('/dashboard', { replace: true });
  };

  if (isLoading) {
    return <div className="p-6 text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Complete Your Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your Designation and Department are needed for documents generated on your behalf.
          Please fill this in once before continuing.
        </p>
        <FacultyProfileForm initialProfile={profile} email={profile?.email} roles={user?.roles || []} onSaved={handleSaved} />
      </div>
    </div>
  );
}
