import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { saveStep1Personal } from '../../../../api/recruitmentApi';
import CandidateDocumentSlot from './CandidateDocumentSlot';
import { FIELD_CLASS, LABEL_CLASS } from './wizardStyles';
import {
  GENDERS,
  CANDIDATE_CATEGORIES,
  NATIONALITIES,
  ID_PROOF_TYPES,
  ID_PROOF_TYPE_LABELS,
} from '../../../../constants/recruitmentEnums';

/** Step 1 of the application wizard: SaveStep1PersonalRequestBody's fields. */
export default function Step1Personal({ candidateId, initial, onNext }) {
  const [form, setForm] = useState(() => ({
    fullName: initial?.fullName ?? '',
    mobile: initial?.mobile ?? '',
    gender: initial?.gender ?? '',
    isMarried: initial?.isMarried ?? '',
    dateOfBirth: initial?.dateOfBirth ?? '',
    fatherOrHusbandName: initial?.fatherOrHusbandName ?? '',
    presentAddress: initial?.presentAddress ?? '',
    permanentAddress: initial?.permanentAddress ?? '',
    email: initial?.email ?? '',
    nationality: initial?.nationality || 'Indian',
    category: initial?.category ?? '',
    categoryCertificateDocumentId: initial?.categoryCertificateDocumentId ?? null,
    idProofType: initial?.idProofType ?? '',
    idProofNumber: initial?.idProofNumber ?? '',
    idProofDocumentId: initial?.idProofDocumentId ?? null,
  }));
  const [sameAsPresent, setSameAsPresent] = useState(() => {
    if (initial?.presentAddress && initial?.permanentAddress) {
      return initial.presentAddress === initial.permanentAddress;
    }
    return false;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSameAsPresentChange = (e) => {
    const checked = e.target.checked;
    setSameAsPresent(checked);
    if (checked) {
      setForm((prev) => ({ ...prev, permanentAddress: prev.presentAddress }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      const cleaned = value.replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: cleaned }));
    } else if (name === 'presentAddress') {
      setForm((prev) => ({
        ...prev,
        presentAddress: value,
        ...(sameAsPresent ? { permanentAddress: value } : {}),
      }));
    } else if (name === 'permanentAddress') {
      setForm((prev) => ({ ...prev, permanentAddress: value }));
      if (sameAsPresent && value !== form.presentAddress) {
        setSameAsPresent(false);
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    if (!form.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!/^\d{10}$/.test(form.mobile)) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!form.gender) {
      setError('Gender is required.');
      return;
    }
    if (!form.dateOfBirth) {
      setError('Date of birth is required.');
      return;
    }
    if (!form.fatherOrHusbandName.trim()) {
      setError("Father's / Husband's name is required.");
      return;
    }
    if (!form.presentAddress.trim()) {
      setError('Present address is required.');
      return;
    }
    if (!form.permanentAddress.trim()) {
      setError('Permanent address is required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!form.nationality) {
      setError('Nationality is required.');
      return;
    }
    if (!form.category) {
      setError('Category is required.');
      return;
    }
    if (!form.idProofType) {
      setError('ID Proof Type is required.');
      return;
    }
    if (form.idProofType && !form.idProofNumber.trim()) {
      setError('ID Proof Number is required.');
      return;
    }
    if (form.idProofType && !form.idProofDocumentId) {
      setError(`${ID_PROOF_TYPE_LABELS[form.idProofType] || 'ID Proof'} Document is required.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload = {
      candidateId,
      fullName: form.fullName,
      mobile: form.mobile,
      gender: form.gender || null,
      isMarried: form.isMarried === '' ? null : form.isMarried === 'true',
      dateOfBirth: form.dateOfBirth || null,
      fatherOrHusbandName: form.fatherOrHusbandName || null,
      presentAddress: form.presentAddress || null,
      permanentAddress: form.permanentAddress || null,
      email: form.email || null,
      nationality: form.nationality || null,
      category: form.category || null,
      categoryCertificateDocumentId: form.categoryCertificateDocumentId || null,
      idProofType: form.idProofType || null,
      idProofNumber: form.idProofNumber || null,
      idProofDocumentId: form.idProofDocumentId || null,
    };
    try {
      await saveStep1Personal(payload);
      // Hand the saved values back so the wizard's cached draft stays current
      // and stepping Back here re-seeds from what was actually saved.
      onNext(payload);
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Mobile number <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="tel"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Mobile number must be exactly 10 digits"
            name="mobile"
            placeholder="10-digit mobile number"
            value={form.mobile}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Gender <span className="text-red-500">*</span>
          </label>
          <select required name="gender" value={form.gender} onChange={handleChange} className={FIELD_CLASS}>
            <option value="">-- Select --</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>Marital status</label>
          <select name="isMarried" value={form.isMarried} onChange={handleChange} className={FIELD_CLASS}>
            <option value="">-- Select --</option>
            <option value="true">Married</option>
            <option value="false">Unmarried</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Date of birth <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Father's / Husband's name <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            name="fatherOrHusbandName"
            value={form.fatherOrHusbandName}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className={LABEL_CLASS}>
            Present address <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            name="presentAddress"
            rows={2}
            value={form.presentAddress}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className={LABEL_CLASS}>
              Permanent address <span className="text-red-500">*</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400 select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <input
                type="checkbox"
                checked={sameAsPresent}
                onChange={handleSameAsPresentChange}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
              />
              <span>Same as Present Address</span>
            </label>
          </div>
          <textarea
            required
            name="permanentAddress"
            rows={2}
            value={form.permanentAddress}
            onChange={handleChange}
            readOnly={sameAsPresent}
            className={`${FIELD_CLASS} ${sameAsPresent ? 'bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed opacity-90' : ''}`}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Email <span className="text-red-500">*</span>
          </label>
          <input required type="email" name="email" value={form.email} onChange={handleChange} className={FIELD_CLASS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Nationality <span className="text-red-500">*</span>
          </label>
          <select
            required
            name="nationality"
            value={form.nationality}
            onChange={handleChange}
            className={FIELD_CLASS}
          >
            {NATIONALITIES.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            Category <span className="text-red-500">*</span>
          </label>
          <select required name="category" value={form.category} onChange={handleChange} className={FIELD_CLASS}>
            <option value="">-- Select --</option>
            {CANDIDATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLASS}>
            ID Proof Type <span className="text-red-500">*</span>
          </label>
          <select
            required
            name="idProofType"
            value={form.idProofType}
            onChange={(e) => {
              const val = e.target.value;
              setForm((prev) => ({
                ...prev,
                idProofType: val,
                idProofNumber: val ? prev.idProofNumber : '',
                idProofDocumentId: val ? prev.idProofDocumentId : null,
              }));
            }}
            className={FIELD_CLASS}
          >
            <option value="">-- Select ID Proof --</option>
            {ID_PROOF_TYPES.map((idType) => (
              <option key={idType.value} value={idType.value}>
                {idType.label}
              </option>
            ))}
          </select>
        </div>

        {form.idProofType && (
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>
              {ID_PROOF_TYPE_LABELS[form.idProofType]
                ? `${ID_PROOF_TYPE_LABELS[form.idProofType]} Number`
                : 'ID Proof Number'} <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="idProofNumber"
              placeholder={`Enter ${ID_PROOF_TYPE_LABELS[form.idProofType] || 'ID Proof'} number`}
              value={form.idProofNumber}
              onChange={handleChange}
              className={FIELD_CLASS}
            />
          </div>
        )}
      </div>

      {form.category && form.category !== 'General' && (
        <CandidateDocumentSlot
          ownerType="Candidate"
          ownerId={candidateId}
          kind="CandidateCategoryCertificate"
          label="Category certificate"
          documentId={form.categoryCertificateDocumentId}
          onChange={(id) => setForm((prev) => ({ ...prev, categoryCertificateDocumentId: id }))}
        />
      )}

      {form.idProofType && (
        <CandidateDocumentSlot
          ownerType="Candidate"
          ownerId={candidateId}
          kind="CandidateIdProof"
          label={`${ID_PROOF_TYPE_LABELS[form.idProofType] || 'ID Proof'} Document`}
          documentId={form.idProofDocumentId}
          onChange={(id) => setForm((prev) => ({ ...prev, idProofDocumentId: id }))}
        />
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/10 transition-all"
        >
          {isSaving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  );
}
