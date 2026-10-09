import { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

export default function UploadManpowerDocumentModal({ isOpen, onClose, project, manpower, onComplete }) {
  const [formData, setFormData] = useState({
    documentType: '',
    documentFile: null
  });
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'documentFile') {
      setFormData(prev => ({ ...prev, documentFile: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.documentType || !formData.documentFile) {
      setError("Please select a document type and file.");
      return;
    }
    
    try {
      const { uploadDocument } = await import('../../../api/documentsApi');
      const { getOrCreateRecruitment } = await import('../utils/recruitmentHelper');
      const recId = await getOrCreateRecruitment(project?.id, manpower?.id);
      
      let backendKind = formData.documentType;
      if (backendKind === 'ScreeningProforma' || backendKind === 'SelectionProforma') {
        backendKind = 'Proforma';
      }
      
      const payload = new FormData();
      payload.append('File', formData.documentFile);
      payload.append('OwnerType', 'RecruitmentRequest'); // Corrected from 'Recruitment' to match backend OwnerType schema
      payload.append('OwnerId', recId);
      payload.append('Kind', backendKind);
      
      await uploadDocument(payload);
      if (onComplete) onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to upload document:', err);
      setError('Failed to upload document: ' + (err?.response?.data?.message || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Upload Manpower Document</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Upload a signed PDF document for {manpower?.designation || 'this position'}.</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          <form id="uploadManpowerForm" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Document Type <span className="text-red-500">*</span></label>
                <select required name="documentType" value={formData.documentType} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                  <option value="">-- Select Document Type --</option>
                  <option value="Advertisement">Advertisement</option>
                  <option value="ScreeningProforma">Screening Proforma</option>
                  <option value="SelectionProforma">Selection Proforma</option>
                  <option value="MinutesOfSelection">Minutes of Selection</option>
                  <option value="MeritList">Merit List / Shortlisted Candidates</option>
                  <option value="JoiningLetter">Joining Letter</option>
                  <option value="OfferLetter">Offer Letter</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Upload Document (PDF only) <span className="text-red-500">*</span></label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="space-y-2 text-center flex flex-col items-center">
                    <FileText className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600 dark:text-slate-300">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none px-2 py-1 shadow-sm border border-slate-200 dark:border-slate-600">
                        <span>Upload a file</span>
                        <input id="file-upload" name="documentFile" type="file" className="sr-only" accept=".pdf" required onChange={handleChange} />
                      </label>
                      <p className="pl-1 pt-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formData.documentFile ? formData.documentFile.name : 'PDF up to 10MB'}
                    </p>
                  </div>
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
            form="uploadManpowerForm"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Upload size={16} /> Upload Document
          </button>
        </div>
      </div>
    </div>
  );
}
