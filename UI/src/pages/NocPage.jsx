import { useState, useEffect, useCallback } from 'react';
import { FileCheck, Plus, CheckCircle, XCircle, Download, Eye } from 'lucide-react';
import { createNocRequest, getNocRequests, processNocAction } from '../api/nocApi';
import { useAuth } from '../auth/useAuth';
import RichTextEditor from '../components/RichTextEditor';
import CertificateTemplateToolbar, { CertificatePreviewModal } from '../components/CertificateTemplateToolbar';
import toast from 'react-hot-toast';

const DEFAULT_NOC_TEMPLATES = [
  {
    id: 'sys-noc-1',
    name: 'Standard PhD NOC Request',
    htmlBody: `<p>This is to certify that <strong>[Student Name]</strong> (Enrollment No: <strong>[Enrollment No]</strong>) is a registered Ph.D. Scholar in the Department of <strong>[Department]</strong> at Motilal Nehru National Institute of Technology Allahabad, Prayagraj.</p>
<p>The Institute has <strong>NO OBJECTION</strong> to the scholar visiting / applying for <strong>[Purpose / Target Organization]</strong>.</p>
<p>This No Objection Certificate is being issued upon request for official academic and research purposes.</p>`
  },
  {
    id: 'sys-noc-2',
    name: 'NOC for External Visit / Conference',
    htmlBody: `<p>This is to certify that <strong>[Student Name]</strong> (Enrollment No: <strong>[Enrollment No]</strong>) is pursuing Ph.D. research in the Department of <strong>[Department]</strong>, MNNIT Allahabad.</p>
<p>The Department / Institute has <strong>NO OBJECTION</strong> to the candidate attending and presenting research work at <strong>[Target Organization / Event Name]</strong>.</p>
<p>The candidate will be granted official leave as per Institute rules for the duration of the event.</p>`
  }
];

export default function NocPage() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [isNewRequestPreviewOpen, setIsNewRequestPreviewOpen] = useState(false);
  const [formData, setFormData] = useState({
    enrollmentNumber: '',
    departmentId: 'c0a80101-0000-0000-0000-000000000001',
    purpose: '',
    targetOrganization: '',
    certificateBody: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const canApproveAtCurrentStage = (status) => {
    if (userRoles.includes('SuperAdmin')) return true;
    if (status === 'Pending PI Approval') return userRoles.includes('Faculty');
    if (status === 'Pending HOD Approval') return userRoles.includes('HOD');
    if (status === 'Pending DA Action') return userRoles.includes('RegularStaff');
    if (status === 'Pending Superintendent Action') return userRoles.includes('Superintendent');
    if (status === 'Pending DR Action') return userRoles.includes('DeputyRegistrar');
    if (status === 'Pending Dean Approval') return userRoles.includes('Dean');
    if (status === 'Pending') return userRoles.includes('Faculty') || userRoles.includes('HOD') || userRoles.includes('Dean');
    return false;
  };

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNocRequests();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await createNocRequest(formData);
      setShowModal(false);
      setFormData({
        enrollmentNumber: '',
        departmentId: 'c0a80101-0000-0000-0000-000000000001',
        purpose: '',
        targetOrganization: '',
        certificateBody: ''
      });
      await loadRequests();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit NOC request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await processNocAction(id, action);
      await loadRequests();
    } catch (err) {
      toast.error(err?.message || 'Action failed');
    }
  };

  const handleDownloadCertificate = (id) => {
    setPreviewId(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <FileCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">PhD NOC</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Request and approve PhD NOC certificates for research collaborations and external visits.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Request New NOC
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <FileCheck size={40} className="text-slate-400 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No NOC requests found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-5 py-4">Student Name</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{r.studentName}</td>
                  <td className="px-5 py-4">{r.departmentName}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${
                      r.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : r.status === 'Rejected'
                        ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    {r.status !== 'Approved' && r.status !== 'Rejected' && canApproveAtCurrentStage(r.status) ? (
                      <>
                        <button
                          onClick={() => handleAction(r.id, 'Approve')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium inline-flex items-center gap-1"
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleAction(r.id, 'Reject')}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium inline-flex items-center gap-1"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    ) : r.status !== 'Approved' && r.status !== 'Rejected' ? (
                      <span className="text-xs italic text-slate-400">Action Pending Forward Stage</span>
                    ) : null}
                    <button
                      onClick={() => handleDownloadCertificate(r.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Download size={14} /> View Certificate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Submit PhD NOC Request</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                    Certificate Body
                  </label>
                  <CertificateTemplateToolbar
                    storageKey="mnnit_noc_body_templates"
                    defaultTemplates={DEFAULT_NOC_TEMPLATES}
                    currentBody={formData.certificateBody}
                    certificateTypeLabel="PhD NOC"
                    documentTitle="PhD NOC Certificate Preview"
                    onSelectTemplate={(html) => {
                      setFormData((prev) => ({ ...prev, certificateBody: html }));
                      setEditorKey((k) => k + 1);
                    }}
                  />
                </div>
                <div className="text-xs text-slate-500 mb-2">Write the full content of your NOC certificate here.</div>
                <RichTextEditor
                  key={editorKey}
                  content={formData.certificateBody}
                  onChange={(html) => setFormData({ ...formData, certificateBody: html })}
                  placeholder="Start writing the certificate body..."
                  height={500}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewRequestPreviewOpen(true)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Eye size={16} className="text-blue-600 dark:text-blue-400" /> Preview
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewRequestPreviewOpen && (
        <CertificatePreviewModal
          isOpen={isNewRequestPreviewOpen}
          onClose={() => setIsNewRequestPreviewOpen(false)}
          title="PhD NOC Certificate Preview"
          certificateTypeLabel="No Objection Certificate"
          certificateBodyHtml={formData.certificateBody}
        />
      )}

      {previewId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Certificate Preview</h2>
              <button
                onClick={() => setPreviewId(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white">
              <iframe
                src={`${import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054'}/api/noc-requests/${previewId}/certificate`}
                className="w-full h-full"
                title="Certificate Preview"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-auto">
              <button
                onClick={() => {
                  window.open(`${import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054'}/api/noc-requests/${previewId}/certificate`, '_blank');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
