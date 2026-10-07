import { useEffect, useState } from 'react';
import { X, Printer, Download, Eye, FileText, CheckCircle2, User, Award, Briefcase, BookOpen, AlertCircle } from 'lucide-react';
import { getOwnDraft } from '../../../api/recruitmentApi';
import { documentDownloadPath } from '../../../api/documentsApi';
import ViewManpowerDocumentModal from '../../projects/components/ViewManpowerDocumentModal';
import AuthenticatedDocumentImage from './AuthenticatedDocumentImage';
import {
  EDUCATION_LEVEL_LABELS,
  CANDIDATE_CATEGORY_LABELS,
  NATIONALITY_LABELS,
  ACADEMIC_DIVISION_LABELS,
  APPOINTMENT_NATURE_LABELS,
  ID_PROOF_TYPE_LABELS,
  sortEducationRows,
} from '../../../constants/recruitmentEnums';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SummaryRow({ label, value, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-left sm:text-right">
        {children ?? value ?? '—'}
      </span>
    </div>
  );
}

function SectionBlock({ title, icon: Icon, children }) {
  return (
    <div className="section-print-block p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        {Icon && <Icon size={16} className="text-blue-600 dark:text-blue-400" />}
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ViewCandidateApplicationModal({ candidateId, isOpen, onClose, initialData = null }) {
  const [draft, setDraft] = useState(initialData);
  const [isLoading, setIsLoading] = useState(!initialData && Boolean(candidateId));
  const [error, setError] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({ isOpen: false, title: '', url: null });

  useEffect(() => {
    if (!isOpen || !candidateId) return;
    if (initialData) {
      setDraft(initialData);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    getOwnDraft(candidateId)
      .then((data) => setDraft(data))
      .catch((err) => setError(err.message ?? 'Failed to load application details.'))
      .finally(() => setIsLoading(false));
  }, [candidateId, isOpen, initialData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const openDoc = (title, docId) => {
    if (!docId) return;
    setDocumentPreview({
      isOpen: true,
      title: title,
      url: documentDownloadPath(docId),
    });
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Printable CSS Rules */}
      <style>{`
        @media print {
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          body * {
            visibility: hidden !important;
          }
          .printable-modal-overlay,
          .printable-modal-overlay * {
            visibility: visible !important;
          }
          .printable-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }
          #printable-application-modal {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            display: block !important;
          }
          #printable-application-modal * {
            max-height: none !important;
            overflow: visible !important;
          }
          #printable-application-modal .overflow-y-auto,
          #printable-application-modal .overflow-x-auto {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .section-print-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            margin-bottom: 1rem !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm no-print" onClick={onClose} />

      {/* Modal Window */}
      <div
        id="printable-application-modal"
        className="relative w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10"
      >
        {/* Modal Top Header (Hidden on print) */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 no-print">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600 dark:text-blue-400" size={20} />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Candidate Application Form</h2>
              <p className="text-xs text-slate-500">MNNIT Allahabad • Submitted Application Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Printer size={15} /> Print / Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="text-sm font-semibold">Loading candidate application form...</span>
            </div>
          ) : error || !draft ? (
            <div className="p-8 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-rose-600 font-bold text-sm">
                <AlertCircle size={18} />
                <span>{error ?? 'Could not load application details.'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-slate-800 dark:text-slate-200 font-sans">
              
              {/* Institution Header Banner */}
              <div className="text-center border-b-2 border-slate-900 dark:border-slate-100 pb-4 space-y-1">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY ALLAHABAD
                </h1>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                  PRAYAGRAJ - 211004, UTTAR PRADESH, INDIA
                </p>
                <p className="text-xs font-extrabold text-blue-700 dark:text-blue-400 uppercase pt-1">
                  OFFICE OF THE DEAN (RESEARCH & CONSULTANCY) • APPLICATION FORM
                </p>
              </div>

              {/* Status Header Block & Photo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 items-center">
                <div className="md:col-span-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase text-slate-500">Application Status:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {draft.applicationStatus === 'Submitted' ? 'SUBMITTED' : 'DRAFT'}
                    </span>
                    {draft.declarationAcceptedAt && (
                      <span className="text-xs text-slate-500 font-semibold">
                        • Submitted on {formatDate(draft.declarationAcceptedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Applicant: {draft.fullName || '—'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    Application ID: <span className="font-mono">{draft.id}</span>
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  {draft.photoDocumentId ? (
                    <div className="relative group text-center flex flex-col items-center">
                      <AuthenticatedDocumentImage
                        documentId={draft.photoDocumentId}
                        alt="Candidate Photograph"
                        className="w-28 h-36 object-cover rounded-lg border-2 border-slate-300 dark:border-slate-700 shadow-sm bg-white"
                        fallback={
                          <div className="w-28 h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400 text-[11px] text-center p-2">
                            <User size={24} />
                            <span>Photo</span>
                          </div>
                        }
                      />
                      <button
                        type="button"
                        onClick={() => openDoc('Passport Photo', draft.photoDocumentId)}
                        className="mt-1 text-[11px] font-bold text-blue-600 hover:underline no-print flex items-center justify-center gap-1"
                      >
                        <Eye size={11} /> View Photo
                      </button>
                    </div>
                  ) : (
                    <div className="w-28 h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400 text-[11px] text-center p-2">
                      <User size={24} />
                      <span>Photo not uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 1. Personal Details */}
              <SectionBlock title="1. Personal Information" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <SummaryRow label="Full Name" value={draft.fullName} />
                  <SummaryRow label="Mobile Number" value={draft.mobile} />
                  <SummaryRow label="Email Address" value={draft.email} />
                  <SummaryRow label="Gender" value={draft.gender} />
                  <SummaryRow
                    label="Marital Status"
                    value={draft.isMarried == null ? '—' : draft.isMarried ? 'Married' : 'Unmarried'}
                  />
                  <SummaryRow label="Date of Birth" value={formatDate(draft.dateOfBirth)} />
                  <SummaryRow label="Father's / Husband's Name" value={draft.fatherOrHusbandName} />
                  <SummaryRow
                    label="Nationality"
                    value={NATIONALITY_LABELS[draft.nationality] ?? draft.nationality}
                  />
                  <SummaryRow label="Category" value={CANDIDATE_CATEGORY_LABELS[draft.category] ?? draft.category}>
                    <div className="flex items-center gap-2 justify-end">
                      <span>{CANDIDATE_CATEGORY_LABELS[draft.category] ?? draft.category ?? '—'}</span>
                      {draft.categoryCertificateDocumentId && (
                        <button
                          type="button"
                          onClick={() => openDoc('Category Certificate', draft.categoryCertificateDocumentId)}
                          className="no-print text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <Eye size={12} /> Cert
                        </button>
                      )}
                    </div>
                  </SummaryRow>
                  <SummaryRow
                    label="ID Proof Type"
                    value={ID_PROOF_TYPE_LABELS[draft.idProofType] ?? draft.idProofType ?? '—'}
                  />
                  <SummaryRow label="ID Proof Number" value={draft.idProofNumber}>
                    <div className="flex items-center gap-2 justify-end">
                      <span>{draft.idProofNumber || '—'}</span>
                      {draft.idProofDocumentId && (
                        <button
                          type="button"
                          onClick={() => openDoc('ID Proof Document', draft.idProofDocumentId)}
                          className="no-print text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <Eye size={12} /> View Doc
                        </button>
                      )}
                    </div>
                  </SummaryRow>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Present Address:</span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line">
                      {draft.presentAddress || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Permanent Address:</span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line">
                      {draft.permanentAddress || '—'}
                    </p>
                  </div>
                </div>
              </SectionBlock>

              {/* 2. Qualifications */}
              <SectionBlock title="2. Educational Qualifications & National Exams" icon={Award}>
                <SummaryRow
                  label="GATE / NET / GPAT Qualification"
                  value={
                    draft.gateNetGpatQualified
                      ? `Qualified (Roll No: ${draft.gateNetGpatRollNo || '—'}, Year: ${draft.gateNetGpatYear || '—'}, Score: ${draft.gateNetGpatScore || '—'})`
                      : 'Not Qualified'
                  }
                >
                  <div className="flex items-center gap-2 justify-end">
                    <span>
                      {draft.gateNetGpatQualified
                        ? `Qualified (${draft.gateNetGpatRollNo || '—'}, ${draft.gateNetGpatYear || '—'}, Score: ${draft.gateNetGpatScore || '—'})`
                        : 'Not Qualified'}
                    </span>
                    {draft.gateNetGpatCertificateDocumentId && (
                      <button
                        type="button"
                        onClick={() => openDoc('GATE/NET Certificate', draft.gateNetGpatCertificateDocumentId)}
                        className="no-print text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <Eye size={12} /> Certificate
                      </button>
                    )}
                  </div>
                </SummaryRow>

                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Education History:</h4>
                  {draft.education?.length ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-600 dark:text-slate-300 uppercase">
                          <tr>
                            <th className="p-2.5">Level</th>
                            <th className="p-2.5">Board / Univ / Inst</th>
                            <th className="p-2.5">Year</th>
                            <th className="p-2.5">Marks / CGPA</th>
                            <th className="p-2.5">Division</th>
                            <th className="p-2.5 no-print text-right">Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {sortEducationRows(draft.education).map((e, i) => (
                            <tr key={e.id ?? i}>
                              <td className="p-2.5 font-bold">
                                {e.level === 'Other' && e.otherLevelName ? `Other (${e.otherLevelName})` : EDUCATION_LEVEL_LABELS[e.level] ?? e.level}
                              </td>
                              <td className="p-2.5">{e.boardInstituteUniv || '—'}</td>
                              <td className="p-2.5">{e.year || '—'}</td>
                              <td className="p-2.5">{e.marksOrCgpa || '—'}</td>
                              <td className="p-2.5">{ACADEMIC_DIVISION_LABELS[e.division] ?? e.division ?? '—'}</td>
                              <td className="p-2.5 no-print text-right">
                                {e.certificateDocumentId ? (
                                  <button
                                    type="button"
                                    onClick={() => openDoc(`${e.level} Certificate`, e.certificateDocumentId)}
                                    className="text-blue-600 hover:underline font-bold flex items-center gap-1 justify-end"
                                  >
                                    <Eye size={12} /> View
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No education rows recorded.</p>
                  )}
                </div>
              </SectionBlock>

              {/* 3. Work Experience */}
              <SectionBlock title="3. Work Experience" icon={Briefcase}>
                {draft.experiences?.length ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-600 dark:text-slate-300 uppercase">
                        <tr>
                          <th className="p-2.5">Organization</th>
                          <th className="p-2.5">Position</th>
                          <th className="p-2.5">Duration</th>
                          <th className="p-2.5">Appointment Nature</th>
                          <th className="p-2.5">Salary</th>
                          <th className="p-2.5 no-print text-right">Certificate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {draft.experiences.map((x, i) => (
                          <tr key={x.id ?? i}>
                            <td className="p-2.5 font-bold">{x.organization || '—'}</td>
                            <td className="p-2.5">{x.position || '—'}</td>
                            <td className="p-2.5">
                              {x.periodYears || 0}y {x.periodMonths || 0}m {x.periodDays || 0}d
                            </td>
                            <td className="p-2.5">{APPOINTMENT_NATURE_LABELS[x.natureOfAppointment] ?? x.natureOfAppointment ?? '—'}</td>
                            <td className="p-2.5">{x.salaryEmoluments || '—'}</td>
                            <td className="p-2.5 no-print text-right">
                              {x.certificateDocumentId ? (
                                <button
                                  type="button"
                                  onClick={() => openDoc(`Experience Certificate - ${x.organization}`, x.certificateDocumentId)}
                                  className="text-blue-600 hover:underline font-bold flex items-center gap-1 justify-end"
                                >
                                  <Eye size={12} /> View
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No experience rows recorded.</p>
                )}
              </SectionBlock>

              {/* 4. Publications & Research */}
              <SectionBlock title="4. Publications & Research Output" icon={BookOpen}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <SummaryRow label="Publication Name / Link" value={draft.publicationName} />
                  <SummaryRow label="SCI Journal Papers" value={draft.sciJournalCount} />
                  <SummaryRow label="Scopus Journal Papers" value={draft.scopusJournalCount} />
                  <SummaryRow label="Non-SCI Journal Papers" value={draft.nonSciJournalCount} />
                  <SummaryRow label="International Conferences" value={draft.internationalConfCount} />
                  <SummaryRow label="National Conferences" value={draft.nationalConfCount} />
                  <SummaryRow label="Publications Document">
                    {draft.publicationsDocumentId ? (
                      <button
                        type="button"
                        onClick={() => openDoc('Publications Document', draft.publicationsDocumentId)}
                        className="no-print text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={12} /> View Document
                      </button>
                    ) : (
                      'Not uploaded'
                    )}
                  </SummaryRow>
                  <SummaryRow
                    label="Higher Degree Registration"
                    value={draft.wantsHigherDegreeRegistration ? 'Yes' : 'No'}
                  />
                </div>
                {draft.otherInformation && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Other Information:</span>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line">
                      {draft.otherInformation}
                    </p>
                  </div>
                )}
              </SectionBlock>

              {/* 5. Resume / CV & Remarks */}
              <SectionBlock title="5. Resume / CV & Candidate Remarks" icon={FileText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <SummaryRow label="Resume / CV Document">
                    {draft.resumeDocumentId ? (
                      <button
                        type="button"
                        onClick={() => openDoc('Resume / CV', draft.resumeDocumentId)}
                        className="no-print text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={12} /> View Resume / CV
                      </button>
                    ) : (
                      'Not uploaded'
                    )}
                  </SummaryRow>
                  <SummaryRow label="Remarks" value={draft.remarks || '—'} />
                </div>
              </SectionBlock>

              {/* 6. Declaration & Signature */}
              <SectionBlock title="6. Candidate Declaration & Signature" icon={CheckCircle2}>
                <div className="p-3 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-300">
                  I hereby declare that the information provided in this application form is true, complete, and correct to the best of my knowledge and belief. I understand that in the event of any information being found false or incorrect at any stage, my candidature is liable to be cancelled.
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Declaration Status:</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={15} /> Accepted & Verified
                    </p>
                    {draft.declarationAcceptedAt && (
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Timestamp: {new Date(draft.declarationAcceptedAt).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    {draft.signatureDocumentId ? (
                      <div className="text-center flex flex-col items-center">
                        <AuthenticatedDocumentImage
                          documentId={draft.signatureDocumentId}
                          alt="Candidate Signature"
                          className="max-h-16 max-w-[200px] object-contain border-b border-slate-400 pb-1 bg-white"
                          fallback={
                            <span className="text-xs text-slate-400 italic">Signature Uploaded</span>
                          }
                        />
                        <button
                          type="button"
                          onClick={() => openDoc('Signature', draft.signatureDocumentId)}
                          className="mt-1 text-[11px] font-bold text-blue-600 hover:underline no-print flex items-center gap-0.5 justify-center"
                        >
                          <Eye size={11} /> View Signature
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Signature Not Uploaded</span>
                    )}
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mt-1">
                      Candidate Signature
                    </span>
                  </div>
                </div>
              </SectionBlock>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <Printer size={15} /> Print / Download PDF
          </button>
        </div>
      </div>

      {/* Document View Modal */}
      <ViewManpowerDocumentModal
        isOpen={documentPreview.isOpen}
        onClose={() => setDocumentPreview({ isOpen: false, title: '', url: null })}
        documentTitle={documentPreview.title}
        documentUrl={documentPreview.url}
      />
    </div>
  );
}
