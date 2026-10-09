import { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { listFacultyDirectory } from '../../../api/recruitmentApi';
import { listActiveDepartments } from '../../../api/departmentsApi';
import { uploadDocument } from '../../../api/documentsApi';

const FIELD_CLASS =
  'px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm';

const READONLY_CLASS =
  'px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ' +
  'rounded-lg text-sm text-slate-600 dark:text-slate-400';

/** A blank picker value -- the shape submitted for one committee-member slot. */
export function newPickerValue() {
  return {
    scope: 'inside', // 'inside' (Inside Institute) | 'outside' (Outside Institute)
    departmentId: '',
    name: '', department: '', position: '', email: '',
    applicationUserId: null,
    isOutsideInstitute: false,
    consentDocumentId: null,
    consentFileName: '',
  };
}

export function pickerToMemberInput(v) {
  return {
    name: v.name,
    department: v.department,
    position: v.position || v.department,
    isExternal: false,
    applicationUserId: v.applicationUserId,
    email: v.email,
    isOutsideInstitute: v.scope === 'outside',
    consentDocumentId: v.consentDocumentId,
  };
}

export function isBlankPickerValue(v) {
  return !v.name.trim() && !v.applicationUserId && !v.consentDocumentId;
}

/**
 * One committee-member slot, reframed (2026-09-22) from a 3-way
 * within-department/outside-department/outside-institute scope into a 2-way
 * Inside Institute / Outside Institute toggle. Inside Institute always shows
 * the department dropdown (defaulting to the PI's own department when one is
 * known) followed by the name dropdown scoped to that department, exactly as
 * the old "within"/"outside" options already did -- this is a UI regrouping
 * of the same two calls (listActiveDepartments/listFacultyDirectory) and the
 * same CommitteeMemberInput shape, not new data-fetching logic.
 */
export default function CommitteeMemberPicker({
  label, value, onChange, required = true, defaultDepartmentId = null, idPrefix, insideOnly = false,
  existingMembers = [],
}) {
  const [departments, setDepartments] = useState([]);
  const [facultyByDept, setFacultyByDept] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    listActiveDepartments()
      .then((data) => setDepartments(data ?? []))
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  const loadFaculty = (departmentId) => {
    if (!departmentId || facultyByDept[departmentId]) return;
    listFacultyDirectory(departmentId)
      .then((data) => setFacultyByDept((prev) => ({ ...prev, [departmentId]: data ?? [] })))
      .catch((err) => console.error('Failed to load faculty for department', departmentId, err));
  };

  useEffect(() => {
    if (value.scope === 'inside' && value.departmentId) loadFaculty(value.departmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setScope = (scope) => {
    if (scope === 'outside') {
      onChange({ ...newPickerValue(), scope: 'outside' });
      return;
    }
    const departmentId = defaultDepartmentId ?? '';
    onChange({ ...newPickerValue(), scope: 'inside', departmentId });
    if (departmentId) loadFaculty(departmentId);
  };

  const selectDepartment = (departmentId) => {
    onChange({ ...value, departmentId, name: '', department: '', position: '', email: '', applicationUserId: null });
    if (departmentId) loadFaculty(departmentId);
  };

  const selectFaculty = (applicationUserId) => {
    const list = facultyByDept[value.departmentId] || [];
    const picked = list.find((f) => f.id === applicationUserId);
    if (!picked) return;
    onChange({
      ...value,
      applicationUserId: picked.id,
      name: picked.fullName,
      department: picked.department || '',
      position: picked.designation || '',
      email: picked.email || '',
    });
  };

  const handleConsentUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('File', file);
      formData.append('OwnerType', 'CommitteeMember');
      formData.append('OwnerId', crypto.randomUUID());
      formData.append('Kind', 'CommitteeMemberConsent');
      const documentId = await uploadDocument(formData);
      onChange({ ...value, consentDocumentId: documentId, consentFileName: file.name });
    } catch {
      // Error is shown via the global toast notification.
    } finally {
      setUploading(false);
    }
  };

  const facultyOptions = facultyByDept[value.departmentId] || [];
  const uid = idPrefix ?? label ?? 'member';

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</p>}

      {!insideOnly && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`inside-outside-${uid}`} checked={value.scope === 'inside'}
              onChange={() => setScope('inside')} className="text-blue-600 focus:ring-blue-500" />
            Inside Institute
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`inside-outside-${uid}`} checked={value.scope === 'outside'}
              onChange={() => setScope('outside')} className="text-blue-600 focus:ring-blue-500" />
            Outside Institute
          </label>
        </div>
      )}
      {insideOnly && (
        <p className="text-[11px] text-slate-400">Must be inside the institute.</p>
      )}

      {value.scope === 'outside' ? (
        <div className="space-y-2">
          <input required={required} type="text" value={value.name} placeholder="Full name"
            aria-label={`${label} name`}
            onChange={(e) => onChange({ ...value, name: e.target.value })} className={`${FIELD_CLASS} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input required={required} type="text" value={value.department} placeholder="Institute / Organization"
              aria-label={`${label} organization`}
              onChange={(e) => onChange({ ...value, department: e.target.value })} className={FIELD_CLASS} />
            <input required={required} type="text" value={value.position} placeholder="Position"
              aria-label={`${label} position`}
              onChange={(e) => onChange({ ...value, position: e.target.value })} className={FIELD_CLASS} />
          </div>
          <input required={required} type="email" value={value.email} placeholder="Email (for the signing link)"
            aria-label={`${label} email`}
            onChange={(e) => onChange({ ...value, email: e.target.value })} className={`${FIELD_CLASS} w-full`} />

          <div className="p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
              <UploadCloud size={14} />
              {value.consentDocumentId ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={14} /> {value.consentFileName}
                </span>
              ) : uploading ? (
                'Uploading…'
              ) : (
                'Upload their signed consent to serve *'
              )}
              <input type="file" hidden accept=".pdf,image/*"
                onChange={(e) => handleConsentUpload(e.target.files?.[0])} />
            </label>
            {!value.consentDocumentId && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Required before this member can be submitted.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <select required={required} value={value.departmentId}
            onChange={(e) => selectDepartment(e.target.value)}
            aria-label={`${label} department`}
            className={`${FIELD_CLASS} w-full`}>
            <option value="">-- Select Department --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select required={required} value={value.applicationUserId ?? ''}
            onChange={(e) => selectFaculty(e.target.value)}
            disabled={!value.departmentId}
            aria-label={`${label} name`}
            className={`${FIELD_CLASS} w-full disabled:opacity-50 disabled:cursor-not-allowed`}>
            <option value="">-- Select Faculty Name --</option>
            {facultyOptions.map((f) => {
              const match = existingMembers.find(
                (m) => (m.applicationUserId && m.applicationUserId === f.id) ||
                       (m.name && m.name.trim().toLowerCase() === f.fullName?.trim().toLowerCase())
              );
              const isAlreadyInCommittee = Boolean(match);
              const suffix = isAlreadyInCommittee
                ? ` — ${match.role === 'NominatedFaculty' ? 'Chosen by Dean' : 'Already in committee'}`
                : '';
              return (
                <option key={f.id} value={f.id} disabled={isAlreadyInCommittee}>
                  {f.fullName}{suffix}
                </option>
              );
            })}
          </select>

          {value.applicationUserId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className={READONLY_CLASS}>{value.position || <span className="italic">Position not on file</span>}</div>
              <div className={READONLY_CLASS}>{value.department}</div>
              <div className={READONLY_CLASS}>{value.email || <span className="italic">No email on file</span>}</div>
            </div>
          )}
          {value.applicationUserId && !value.position && (
            <input type="text" value={value.position} placeholder="Position (not on file -- enter manually)"
              aria-label={`${label} position`}
              onChange={(e) => onChange({ ...value, position: e.target.value })} className={`${FIELD_CLASS} w-full`} />
          )}
        </div>
      )}
    </div>
  );
}
