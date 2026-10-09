import { useState, useEffect } from 'react';
import { X, Check, FileText } from 'lucide-react';
import { getOrCreateRecruitment } from '../utils/recruitmentHelper';
import { getOfferLetterData } from '../../../api/projectsApi';
import toast from 'react-hot-toast';

/// Mounts the form only while open so its state can be seeded straight from
/// props, instead of syncing props into state with an effect on every open.
export default function GenerateOfferLetterModal({ isOpen, onClose, project, manpower, onGenerateComplete }) {
  if (!isOpen) return null;

  return (
    <GenerateOfferLetterForm
      key={manpower?.id ?? 'new'}
      onClose={onClose}
      project={project}
      manpower={manpower}
      onGenerateComplete={onGenerateComplete}
    />
  );
}

function GenerateOfferLetterForm({ onClose, project, manpower, onGenerateComplete }) {
  const [candidates, setCandidates] = useState([]);
  const [formData, setFormData] = useState({
    candidateId: '',
    candidateName: '',
    gender: '',
    parentName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    fellowshipAmount: manpower?.stipend || '',
    hraPercentage: manpower?.hra
      ? (parseFloat(manpower.hra) / parseFloat(manpower.stipend) * 100).toFixed(2)
      : '',
    joiningDate: ''
  });

  useEffect(() => {
    let mounted = true;
    const loadCachedData = async () => {
      try {
        const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
        const data = await getOfferLetterData(recId);
        if (mounted && data) {
          const fellowship = data.fellowshipAmount || manpower?.stipend || '';
          const hraPct = data.fellowshipAmount && data.hraAmount 
            ? ((parseFloat(data.hraAmount) / parseFloat(data.fellowshipAmount)) * 100).toFixed(2)
            : (manpower?.hra ? ((parseFloat(manpower.hra) / parseFloat(manpower.stipend)) * 100).toFixed(2) : '');

          setFormData({
            candidateId: data.candidateId || '',
            candidateName: data.candidateName || '',
            gender: data.gender || '',
            parentName: data.parentName || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            fellowshipAmount: fellowship,
            hraPercentage: hraPct,
            joiningDate: data.joiningDate || ''
          });
        }
      } catch (err) {
        console.log("No previous offer letter data found", err);
      }
      
      // Also fetch the selected candidate if not already populated
      try {
        const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
        const { getRecruitmentCandidates } = await import('../../../api/projectsApi');
        const fetchedCandidates = await getRecruitmentCandidates(recId);
        if (mounted) {
          // Only candidates the screening committee marked Eligible are
          // valid offer-letter recipients (client request, 2026-09-15): pick
          // who to send it to from that list, not from every non-rejected
          // applicant.
          const eligible = fetchedCandidates.filter(c => c.screeningResult === 'Eligible');
          setCandidates(eligible);
          const selected = eligible.find(c => c.outcome === 'Selected') ?? eligible.find(c => c.meritRank === 1);
          if (selected) {
            setFormData(prev => ({
              ...prev,
              candidateId: prev.candidateId || selected.id,
              candidateName: prev.candidateName || selected.fullName
            }));
          }
        }
      } catch (err) {
        console.log("Could not fetch candidates", err);
      }
    };
    loadCachedData();
    return () => { mounted = false; };
  }, [project?.id, manpower?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
      
      if (formData.candidateId) {
        const { issueRecruitmentOffer } = await import('../../../api/projectsApi');
        await issueRecruitmentOffer(recId, {
          candidateId: formData.candidateId,
          recommendedStipend: parseFloat(formData.fellowshipAmount),
          joiningDate: formData.joiningDate
        });
      }

      const { saveDocumentData } = await import('../../../api/recruitmentApi');
      await saveDocumentData(recId, 'OfferLetter', formData);

      const hraAmount = (parseFloat(formData.fellowshipAmount) * parseFloat(formData.hraPercentage || 0)) / 100;
      const params = new URLSearchParams({
        candidateName: formData.candidateName,
        parentName: formData.parentName,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        fellowshipAmount: formData.fellowshipAmount,
        hraAmount: hraAmount.toFixed(2),
        joiningDate: formData.joiningDate
      });
      const url = `/api/recruitments/${recId}/documents/OfferLetter?${params.toString()}`;
      onGenerateComplete('Offer Letter', url);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate offer letter: ' + (err?.response?.data?.message || err.message));
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
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generate Offer Letter</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Fill out the details for the manpower offer letter.</p>
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
          <form id="offerLetterForm" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Eligible Candidate <span className="text-red-500">*</span></label>
                <select
                  required
                  name="candidateId"
                  value={formData.candidateId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const cand = candidates.find(c => c.id === id);
                    setFormData(prev => ({
                      ...prev,
                      candidateId: id,
                      candidateName: cand ? cand.fullName : ''
                    }));
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                >
                  <option value="">-- Select from Eligible Candidates --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} (Rank {c.meritRank || 'N/A'})</option>
                  ))}
                </select>
                {candidates.length === 0 && (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
                    No candidates have been marked Eligible for this position yet.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gender <span className="text-red-500">*</span></label>
                <select required name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Father's/Husband's Name <span className="text-red-500">*</span></label>
                <input required type="text" name="parentName" value={formData.parentName} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">City <span className="text-red-500">*</span></label>
                <input required type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Address <span className="text-red-500">*</span></label>
                <textarea required name="address" value={formData.address} onChange={handleChange} rows="2" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all custom-scrollbar dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">State <span className="text-red-500">*</span></label>
                <input required type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pincode <span className="text-red-500">*</span></label>
                <input required type="text" pattern="[0-9]{6}" title="6-digit pincode" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monthly Fellowship Amount (₹) <span className="text-red-500">*</span></label>
                <input required type="number" min="0" step="0.01" name="fellowshipAmount" value={formData.fellowshipAmount} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">HRA Percentage (%) <span className="text-red-500">*</span></label>
                <input required type="number" min="0" max="100" step="0.01" name="hraPercentage" value={formData.hraPercentage} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Joining Date <span className="text-red-500">*</span></label>
                <input required type="date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" />
              </div>
            </div>

            {/* Project Info Section */}
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Project Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Project Title</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{project?.projectTitle || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Agency</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{project?.agency || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Department</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{project?.department || 'N/A'}</span>
                </div>
              </div>
            </div>
            
          </form>
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
            form="offerLetterForm"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Check size={16} /> Generate Offer Letter
          </button>
        </div>
      </div>
    </div>
  );
}
