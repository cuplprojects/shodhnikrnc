import { useState, useEffect } from 'react';
import { X, Check, UserPlus } from 'lucide-react';
import { getOrCreateRecruitment } from '../utils/recruitmentHelper';
import { getRecruitmentCandidates, recordJoining } from '../../../api/projectsApi';
import toast from 'react-hot-toast';

export default function UpdateSelectionModal({ isOpen, onClose, project, manpower }) {
  const [formData, setFormData] = useState({
    candidateName: '',
    aadharNo: '',
    panNo: '',
    bankAccountNo: '',
    ifscCode: '',
    mobile: '',
    email: '',
    dob: '',
    gender: '',
    joinedOn: '',
    validTill: '',
    recommendedStipend: ''
  });

  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchSelectedCandidate = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
        const fetchedCandidates = await getRecruitmentCandidates(recId);
        
        if (mounted) {
          setCandidates(fetchedCandidates);
          if (fetchedCandidates.length === 0) {
            setError("No candidates have applied for this recruitment position yet.");
          } else {
            const selected = fetchedCandidates.find(c => c.outcome === 'Selected');
            if (selected) {
              setSelectedCandidateId(selected.id);
              setFormData(prev => ({
                ...prev,
                candidateName: selected.fullName,
                mobile: selected.mobile || '',
                recommendedStipend: manpower?.stipend || ''
              }));
            }
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load candidate selection:", err);
        if (mounted) {
          setError("Failed to verify candidate selection. Ensure the recruitment round is active.");
          setIsLoading(false);
        }
      }
    };

    fetchSelectedCandidate();
    return () => { mounted = false; };
  }, [isOpen, project?.id, manpower?.id]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'bankAccountNo') {
      value = value.replace(/\D/g, '');
    } else if (name === 'aadharNo') {
      const digits = value.replace(/\D/g, '').slice(0, 12);
      const parts = [];
      for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4));
      }
      value = parts.join('-');
    } else if (name === 'panNo') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (name === 'ifscCode') {
      value = value.toUpperCase();
    } else if (name === 'recommendedStipend') {
      if (value !== '' && Number(value) < 0) return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCandidateId) {
      toast.error("No selected candidate available to update selection.");
      return;
    }

    if (formData.recommendedStipend !== '' && parseFloat(formData.recommendedStipend) < 0) {
      toast.error("Recommended stipend cannot be negative.");
      return;
    }
    if (formData.aadharNo && !/^\d{4}-\d{4}-\d{4}$/.test(formData.aadharNo)) {
      toast.error("Aadhar number must be 12 digits in 1111-2222-3333 format.");
      return;
    }
    if (formData.panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNo)) {
      toast.error("PAN number must be 10 characters in AAAAA1234J format.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
      await recordJoining(recId, {
        candidateId: selectedCandidateId,
        joinedOn: formData.joinedOn,
        validTill: formData.validTill,
        recommendedStipend: parseFloat(formData.recommendedStipend),
        aadharNo: formData.aadharNo,
        panNo: formData.panNo,
        bankAccountNo: formData.bankAccountNo,
        ifscCode: formData.ifscCode,
        dob: formData.dob,
        gender: formData.gender
      });
      toast.success("Selection saved and joining recorded successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Update Selection</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Record the selected candidate for {manpower?.designation || 'this position'}.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form id="updateSelectionForm" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Name of Selected Candidate <span className="text-red-500">*</span></label>
                  {candidates.some(c => c.outcome === 'Selected') ? (
                    <input required type="text" name="candidateName" value={formData.candidateName} readOnly className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 cursor-not-allowed outline-none" />
                  ) : (
                    <select
                      required
                      value={selectedCandidateId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setSelectedCandidateId(cid);
                        const cand = candidates.find(c => c.id === cid);
                        setFormData(prev => ({
                          ...prev,
                          candidateName: cand ? cand.fullName : '',
                          mobile: cand ? (cand.mobile || '') : '',
                          recommendedStipend: manpower?.stipend || ''
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    >
                      <option value="">-- Select Candidate --</option>
                      {candidates.map(c => (
                        <option key={c.id} value={c.id}>{c.fullName} ({c.mobile || 'No mobile'})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Designation</label>
                  <input type="text" value={manpower?.designation || ''} readOnly className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 cursor-not-allowed" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aadhar No. <span className="text-red-500">*</span></label>
                  <input required type="text" maxLength={14} pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}" title="12-digit Aadhar number in 1111-2222-3333 format" name="aadharNo" value={formData.aadharNo} onChange={handleChange} placeholder="1111-2222-3333" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">PAN No. <span className="text-red-500">*</span></label>
                  <input required type="text" maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}" title="10-character PAN number in AAAAA1234J format" name="panNo" value={formData.panNo} onChange={handleChange} placeholder="AAAAA1234J" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white uppercase font-mono" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bank Account Number <span className="text-red-500">*</span></label>
                  <input required type="text" inputMode="numeric" pattern="[0-9]*" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange} placeholder="Bank account number" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">IFSC Code <span className="text-red-500">*</span></label>
                  <input required type="text" pattern="[a-zA-Z]{4}0[a-zA-Z0-9]{6}" title="11-character IFSC code" name="ifscCode" value={formData.ifscCode} onChange={handleChange} placeholder="SBIN0001234" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white uppercase" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mobile Number <span className="text-red-500">*</span></label>
                  <input required type="tel" pattern="[0-9]{10}" title="10-digit mobile number" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="9876543210" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address <span className="text-red-500">*</span></label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="candidate@example.com" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Date of Birth <span className="text-red-500">*</span></label>
                  <input required type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sex <span className="text-red-500">*</span></label>
                  <select required name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Joined On <span className="text-red-500">*</span></label>
                  <input required type="date" name="joinedOn" value={formData.joinedOn} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Offer Valid Till <span className="text-red-500">*</span></label>
                  <input required type="date" name="validTill" value={formData.validTill} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recommended Stipend (₹) <span className="text-red-500">*</span></label>
                  <input required type="number" min="0" step="0.01" name="recommendedStipend" value={formData.recommendedStipend} onChange={handleChange} placeholder="0.00" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
                </div>

              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 z-10">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="updateSelectionForm"
            disabled={isLoading || isSubmitting || !selectedCandidateId}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            {isSubmitting ? 'Saving...' : 'Save Selection'}
          </button>
        </div>
      </div>
    </div>
  );
}

