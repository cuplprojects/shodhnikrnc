import { useEffect, useState } from 'react';
import { saveMyProfile, uploadMyProfilePhoto } from '../api/myProfileApi';
import { listActiveDepartments } from '../api/departmentsApi';
import { GENDER_OPTIONS, QUALIFICATION_OPTIONS } from '../constants/facultyProfileOptions';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054';

// The backend returns photo paths as server-relative ("/uploads/profile-photos/xyz.png"),
// same convention as ManageAnnouncements.jsx's getPdfUrl -- prefix with the API base so
// <img> can actually load it.
function getPhotoUrl(photoPath) {
  if (!photoPath) return null;
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return photoPath;
  }
  const cleanPath = photoPath.startsWith('/') ? photoPath.slice(1) : photoPath;
  return `${API_BASE_URL}/${cleanPath}`;
}

/**
 * Shared between CompleteProfilePage (the first-login gate) and
 * ProfilePage (editable anytime afterward) -- both wrap this with their
 * own page chrome, but the fields, validation and submit logic live here
 * once, matching this plan's Global Constraint that the form collects
 * the full field set (Designation/Department/Gender/Qualification/
 * JoiningDate/ResearchArea/Photo) even though only the first two gate
 * access.
 */
export default function FacultyProfileForm({ initialProfile, email, roles = [], onSaved }) {
  const [emailValue, setEmailValue] = useState(email ?? initialProfile?.email ?? '');
  const [designation, setDesignation] = useState(initialProfile?.designation ?? '');
  const [department, setDepartment] = useState(initialProfile?.department ?? '');
  const [gender, setGender] = useState(initialProfile?.gender ?? '');
  const [qualification, setQualification] = useState(initialProfile?.qualification ?? '');
  const [joiningDate, setJoiningDate] = useState(initialProfile?.joiningDate ?? '');
  const [researchArea, setResearchArea] = useState(initialProfile?.researchArea ?? '');
  const [employeeId, setEmployeeId] = useState(initialProfile?.employeeId ?? '');
  const [photo, setPhoto] = useState(initialProfile?.photo ?? null);

  const [primaryBankName, setPrimaryBankName] = useState(initialProfile?.primaryBankName ?? '');
  const [primaryBankAccountNo, setPrimaryBankAccountNo] = useState(initialProfile?.primaryBankAccountNo ?? '');
  const [primaryBankIfsc, setPrimaryBankIfsc] = useState(initialProfile?.primaryBankIfsc ?? '');
  const [secondaryBankName, setSecondaryBankName] = useState(initialProfile?.secondaryBankName ?? '');
  const [secondaryBankAccountNo, setSecondaryBankAccountNo] = useState(initialProfile?.secondaryBankAccountNo ?? '');
  const [secondaryBankIfsc, setSecondaryBankIfsc] = useState(initialProfile?.secondaryBankIfsc ?? '');

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  const isFacultyOrHod = roles.includes('Faculty') || roles.includes('HOD');

  useEffect(() => {
    if (email || initialProfile?.email) {
      setEmailValue(email ?? initialProfile?.email ?? '');
    }
  }, [email, initialProfile?.email]);

  useEffect(() => {
    listActiveDepartments()
      .then((departments) => setDepartmentOptions(departments.map((d) => d.name)))
      .catch(() => setDepartmentOptions([]));
  }, []);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError(null);
    try {
      const response = await uploadMyProfilePhoto(file);
      setPhoto(response.url);
    } catch (err) {
      setError('Failed to upload photo: ' + (err.message ?? 'Unknown error'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!designation.trim() || !department) {
      setError('Designation and Department are required.');
      return;
    }

    if (isFacultyOrHod) {
      if (!primaryBankName.trim() || !primaryBankAccountNo.trim() || !primaryBankIfsc.trim()) {
        setError('Primary Bank Account details (Bank Name, Account Number, and IFSC) are mandatory for Faculty and HOD roles.');
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await saveMyProfile({
        email: emailValue.trim() || null,
        designation: designation.trim(),
        department,
        gender: gender || null,
        qualification: qualification || null,
        joiningDate: joiningDate || null,
        researchArea: researchArea.trim() || null,
        photo,
        employeeId: employeeId.trim() || null,
        primaryBankName: primaryBankName.trim(),
        primaryBankAccountNo: primaryBankAccountNo.trim(),
        primaryBankIfsc: primaryBankIfsc.trim(),
        secondaryBankName: secondaryBankName.trim() || null,
        secondaryBankAccountNo: secondaryBankAccountNo.trim() || null,
        secondaryBankIfsc: secondaryBankIfsc.trim() || null,
      });
      onSaved?.();
    } catch (err) {
      setError('Failed to save profile: ' + (err.message ?? 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/50">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
        <input
          type="email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          placeholder="Enter email address"
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Designation <span className="text-red-500">*</span>
          </label>
          <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Professor" className={FIELD_CLASS} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Department <span className="text-red-500">*</span>
          </label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={FIELD_CLASS}>
            <option value="">Select Department</option>
            {department && !departmentOptions.includes(department) && (
              <option value={department}>{department}</option>
            )}
            {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Employee ID</label>
          <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP1234" className={FIELD_CLASS} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={FIELD_CLASS}>
            <option value="">Select Gender</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Qualification</label>
          <select value={qualification} onChange={(e) => setQualification(e.target.value)} className={FIELD_CLASS}>
            <option value="">Select Qualification</option>
            {QUALIFICATION_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Joining Date</label>
          <input type="date" value={joiningDate ?? ''} onChange={(e) => setJoiningDate(e.target.value)} className={FIELD_CLASS} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Photo</label>
          <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} disabled={isUploadingPhoto} className={FIELD_CLASS} />
          {isUploadingPhoto && <p className="text-xs text-slate-500 dark:text-slate-400">Uploading...</p>}
          {photo && !isUploadingPhoto && (
            <img src={getPhotoUrl(photo)} alt="Profile" className="mt-2 h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Research Area</label>
        <textarea value={researchArea} onChange={(e) => setResearchArea(e.target.value)} rows={3} className={FIELD_CLASS} />
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Bank Details</h3>

        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Primary Account {isFacultyOrHod && <span className="text-red-500 normal-case tracking-normal">* (Required)</span>}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bank Name {isFacultyOrHod && <span className="text-red-500">*</span>}</label>
              <input type="text" value={primaryBankName} onChange={(e) => setPrimaryBankName(e.target.value)} placeholder="e.g. State Bank of India" className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Account Number {isFacultyOrHod && <span className="text-red-500">*</span>}</label>
              <input type="text" value={primaryBankAccountNo} onChange={(e) => setPrimaryBankAccountNo(e.target.value)} placeholder="Account No" className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">IFSC Code {isFacultyOrHod && <span className="text-red-500">*</span>}</label>
              <input type="text" value={primaryBankIfsc} onChange={(e) => setPrimaryBankIfsc(e.target.value)} placeholder="IFSC Code" className={FIELD_CLASS} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Secondary Account <span className="text-slate-400 normal-case tracking-normal">(Optional)</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bank Name</label>
              <input type="text" value={secondaryBankName} onChange={(e) => setSecondaryBankName(e.target.value)} placeholder="e.g. HDFC Bank" className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Account Number</label>
              <input type="text" value={secondaryBankAccountNo} onChange={(e) => setSecondaryBankAccountNo(e.target.value)} placeholder="Account No" className={FIELD_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">IFSC Code</label>
              <input type="text" value={secondaryBankIfsc} onChange={(e) => setSecondaryBankIfsc(e.target.value)} placeholder="IFSC Code" className={FIELD_CLASS} />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
      >
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
