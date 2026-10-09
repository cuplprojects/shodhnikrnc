import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, SlidersHorizontal, FileText, Eye,
  ChevronDown, ChevronUp, Users, CheckCircle2, XCircle, Clock,
  Award, BookOpen, Briefcase, Phone, Mail, User, X
} from 'lucide-react';
import { listCandidateDetails, getRecruitment } from '../../api/recruitmentApi';
import { getProject } from '../../api/projectsApi';
import { downloadDocument } from '../../api/documentsApi';
import ViewCandidateApplicationModal from './components/ViewCandidateApplicationModal';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  Eligible:            { color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700', icon: <CheckCircle2 size={12} /> },
  Ineligible:          { color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-300 dark:ring-rose-700', icon: <XCircle size={12} /> },
  Selected:            { color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-700', icon: <Award size={12} /> },
  Waitlisted:          { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700', icon: <Clock size={12} /> },
  'Under consideration':{ color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700', icon: <Clock size={12} /> },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700', icon: <Clock size={12}/> };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      {cfg.icon}{status || 'Pending'}
    </span>
  );
}

const EXCEL_COLUMNS = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'gender', label: 'Gender' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'isMarried', label: 'Marital Status' },
  { key: 'fatherOrHusbandName', label: 'Father/Husband Name' },
  { key: 'presentAddress', label: 'Present Address' },
  { key: 'permanentAddress', label: 'Permanent Address' },
  { key: 'idProofType', label: 'ID Proof Type' },
  { key: 'idProofNumber', label: 'ID Proof Number' },
  { key: 'category', label: 'Category' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'gateNetGpatQualified', label: 'GATE/NET/GPAT Qualified' },
  { key: 'gateNetGpatRollNo', label: 'GATE/NET/GPAT Roll No' },
  { key: 'gateNetGpatYear', label: 'GATE/NET/GPAT Year' },
  { key: 'gateNetGpatScore', label: 'GATE/NET/GPAT Score' },
  { key: 'educationDetails', label: 'Education Details' },
  { key: 'experienceDetails', label: 'Experience Details' },
  { key: 'sciJournalCount', label: 'SCI Journals' },
  { key: 'scopusJournalCount', label: 'Scopus Journals' },
  { key: 'nonSciJournalCount', label: 'Non-SCI Journals' },
  { key: 'internationalConfCount', label: 'Intl Conferences' },
  { key: 'nationalConfCount', label: 'National Conferences' },
  { key: 'publicationName', label: 'Publication Name' },
  { key: 'wantsHigherDegreeRegistration', label: 'Wants Higher Degree Reg.' },
  { key: 'otherInformation', label: 'Other Information' },
  { key: 'candidateRemarks', label: 'Candidate Remarks' },
  { key: 'qualification', label: 'Qualification (Summary)' },
  { key: 'experience', label: 'Experience (Summary)' },
  { key: 'screeningResult', label: 'Screening Result' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'meritRank', label: 'Merit Rank' },
  { key: 'appliedAt', label: 'Applied At' },
  { key: 'screeningRemarks', label: 'Screening Remarks' },
  { key: 'docPhoto', label: 'Photo Link' },
  { key: 'docSignature', label: 'Signature Link' },
  { key: 'docIdProof', label: 'ID Proof Link' },
  { key: 'docCategory', label: 'Category Cert Link' },
  { key: 'docGate', label: 'GATE/NET/GPAT Cert Link' },
  { key: 'docTenth', label: '10th Cert Link' },
  { key: 'docTwelfth', label: '12th Cert Link' },
  { key: 'docDiploma', label: 'Diploma Cert Link' },
  { key: 'docUG', label: 'UG Cert Link' },
  { key: 'docPG', label: 'PG Cert Link' },
  { key: 'docPhD', label: 'PhD Cert Link' },
  { key: 'docPostDoc', label: 'PostDoc Cert Link' },
  { key: 'docOtherEdu', label: 'Other Edu Certs Link' },
  { key: 'docExperience', label: 'Experience Certs Link' },
  { key: 'docPublications', label: 'Publications Doc Link' },
  { key: 'docResume', label: 'Resume Link' },
];

export default function CandidateApplicationsPage() {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [recruitment, setRecruitment] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedRow, setExpandedRow] = useState(null);
  const [viewModalTarget, setViewModalTarget] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState(
    EXCEL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('All');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const recData = await getRecruitment(recruitmentId);
        setRecruitment(recData);
        const projData = await getProject(recData.projectId);
        setProject(projData);
        const candData = await listCandidateDetails(recruitmentId);
        setCandidates(candData);
      } catch (err) {
        console.error('Failed to load candidate applications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [recruitmentId]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        c.summary.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.summary.mobile.includes(searchTerm) ||
        (c.detail.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (statusFilter !== 'All' && c.summary.screeningResult !== statusFilter && c.summary.outcome !== statusFilter) return false;
      return matchesSearch;
    });
  }, [candidates, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: candidates.length,
    eligible: candidates.filter(c => c.summary.screeningResult === 'Eligible').length,
    ineligible: candidates.filter(c => c.summary.screeningResult === 'Ineligible').length,
    pending: candidates.filter(c => !c.summary.screeningResult).length,
  }), [candidates]);

  const getDocLink = (documentId) => {
    if (!documentId) return '';
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054';
    return `${baseUrl}/api/documents/${documentId}/download`;
  };

  const handleExportExcel = () => {
    const toExport = filteredCandidates.filter(c => {
      if (exportType === 'Eligible') return c.summary.screeningResult === 'Eligible';
      if (exportType === 'Ineligible') return c.summary.screeningResult === 'Ineligible';
      return true;
    });
    const data = toExport.map(c => {
      const row = {};
      if (selectedColumns.fullName) row['Full Name'] = c.summary.fullName;
      if (selectedColumns.mobile) row['Mobile'] = c.summary.mobile;
      if (selectedColumns.email) row['Email'] = c.detail.email;
      if (selectedColumns.gender) row['Gender'] = c.detail.gender;
      if (selectedColumns.dateOfBirth) row['Date of Birth'] = c.detail.dateOfBirth;
      if (selectedColumns.isMarried) row['Marital Status'] = c.detail.isMarried ? 'Married' : 'Single';
      if (selectedColumns.fatherOrHusbandName) row['Father/Husband Name'] = c.detail.fatherOrHusbandName;
      if (selectedColumns.presentAddress) row['Present Address'] = c.detail.presentAddress;
      if (selectedColumns.permanentAddress) row['Permanent Address'] = c.detail.permanentAddress;
      if (selectedColumns.idProofType) row['ID Proof Type'] = c.detail.idProofType || '-';
      if (selectedColumns.idProofNumber) row['ID Proof Number'] = c.detail.idProofNumber;
      if (selectedColumns.category) row['Category'] = c.detail.category;
      if (selectedColumns.nationality) row['Nationality'] = c.detail.nationality;
      if (selectedColumns.gateNetGpatQualified) row['GATE/NET/GPAT Qualified'] = c.detail.gateNetGpatQualified ? 'Yes' : 'No';
      if (selectedColumns.gateNetGpatRollNo) row['GATE/NET/GPAT Roll No'] = c.detail.gateNetGpatRollNo;
      if (selectedColumns.gateNetGpatYear) row['GATE/NET/GPAT Year'] = c.detail.gateNetGpatYear;
      if (selectedColumns.gateNetGpatScore) row['GATE/NET/GPAT Score'] = c.detail.gateNetGpatScore;
      if (selectedColumns.educationDetails) row['Education Details'] = (c.detail.education || []).map(e => `${e.level === 'Other' ? e.otherLevelName : e.level}: ${e.subject || ''} from ${e.boardInstituteUniv || ''} (${e.year || ''}) - ${e.marksOrCgpa || ''}`).join(' | ');
      if (selectedColumns.experienceDetails) row['Experience Details'] = (c.detail.experiences || []).map(e => `${e.position} at ${e.organization} (${e.periodYears}Y ${e.periodMonths}M ${e.periodDays}D)`).join(' | ');
      if (selectedColumns.sciJournalCount) row['SCI Journals'] = c.detail.sciJournalCount;
      if (selectedColumns.scopusJournalCount) row['Scopus Journals'] = c.detail.scopusJournalCount;
      if (selectedColumns.nonSciJournalCount) row['Non-SCI Journals'] = c.detail.nonSciJournalCount;
      if (selectedColumns.internationalConfCount) row['Intl Conferences'] = c.detail.internationalConfCount;
      if (selectedColumns.nationalConfCount) row['National Conferences'] = c.detail.nationalConfCount;
      if (selectedColumns.publicationName) row['Publication Name'] = c.detail.publicationName;
      if (selectedColumns.wantsHigherDegreeRegistration) row['Wants Higher Degree Reg.'] = c.detail.wantsHigherDegreeRegistration ? 'Yes' : 'No';
      if (selectedColumns.otherInformation) row['Other Information'] = c.detail.otherInformation;
      if (selectedColumns.candidateRemarks) row['Candidate Remarks'] = c.detail.remarks;
      if (selectedColumns.qualification) row['Qualification (Summary)'] = c.summary.qualification;
      if (selectedColumns.experience) row['Experience (Summary)'] = c.summary.experience;
      if (selectedColumns.screeningResult) row['Screening Result'] = c.summary.screeningResult;
      if (selectedColumns.outcome) row['Outcome'] = c.summary.outcome;
      if (selectedColumns.meritRank) row['Merit Rank'] = c.summary.meritRank;
      if (selectedColumns.appliedAt) row['Applied At'] = new Date(c.summary.appliedAt).toLocaleDateString();
      if (selectedColumns.screeningRemarks) row['Screening Remarks'] = c.summary.screeningRemarks || '';
      const eduLinks = (level) => (c.detail.education || []).filter(e => e.level === level && e.certificateDocumentId).map(e => getDocLink(e.certificateDocumentId)).join(' | ');
      if (selectedColumns.docPhoto) row['Photo Link'] = getDocLink(c.detail.photoDocumentId);
      if (selectedColumns.docSignature) row['Signature Link'] = getDocLink(c.detail.signatureDocumentId);
      if (selectedColumns.docIdProof) row['ID Proof Link'] = getDocLink(c.detail.idProofDocumentId);
      if (selectedColumns.docCategory) row['Category Cert Link'] = getDocLink(c.detail.categoryCertificateDocumentId);
      if (selectedColumns.docGate) row['GATE/NET/GPAT Cert Link'] = getDocLink(c.detail.gateNetGpatCertificateDocumentId);
      if (selectedColumns.docTenth) row['10th Cert Link'] = eduLinks('Tenth');
      if (selectedColumns.docTwelfth) row['12th Cert Link'] = eduLinks('Twelfth');
      if (selectedColumns.docDiploma) row['Diploma Cert Link'] = eduLinks('Diploma');
      if (selectedColumns.docUG) row['UG Cert Link'] = eduLinks('Undergraduate');
      if (selectedColumns.docPG) row['PG Cert Link'] = eduLinks('Postgraduate');
      if (selectedColumns.docPhD) row['PhD Cert Link'] = eduLinks('Doctorate');
      if (selectedColumns.docPostDoc) row['PostDoc Cert Link'] = eduLinks('PostDoctoral');
      if (selectedColumns.docOtherEdu) row['Other Edu Certs Link'] = eduLinks('Other');
      if (selectedColumns.docExperience) row['Experience Certs Link'] = (c.detail.experiences || []).filter(e => e.certificateDocumentId).map(e => getDocLink(e.certificateDocumentId)).join(' | ');
      if (selectedColumns.docPublications) row['Publications Doc Link'] = getDocLink(c.detail.publicationsDocumentId);
      if (selectedColumns.docResume) row['Resume Link'] = getDocLink(c.detail.resumeDocumentId);
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    const fileName = exportType === 'All'
      ? `Candidates_${recruitment?.advertisementRound || 'Export'}.xlsx`
      : `Comparative_Sheet_${exportType}_${recruitment?.advertisementRound || 'Export'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setShowExportModal(false);
  };

  const handleDownloadDoc = async (documentId, documentType) => {
    if (!documentId) return;
    try {
      const blob = await downloadDocument(documentId);

      // Determine the correct file extension from the blob's MIME type
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      };
      const ext = mimeToExt[blob.type] || 'bin';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Candidate_${documentType}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast.error('Failed to download document.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading candidates…</p>
      </div>
    );
  }

  return (
    <div className=" mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-300">

      {/* Back */}
      <button
        onClick={() => navigate(`/recruitments/${recruitmentId}`)}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Recruitment Details
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
              <Users size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Candidate Applications</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {project?.title
                  ? <><span className="font-medium text-slate-700 dark:text-slate-300">{project.title}</span> · {recruitment?.advertisementRound}</>
                  : recruitment?.advertisementRound}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setExportType('Eligible'); setShowExportModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Download size={15} /> Eligible Sheet
            </button>
            <button
              onClick={() => { setExportType('Ineligible'); setShowExportModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Download size={15} /> Not Eligible Sheet
            </button>
            <button
              onClick={() => { setExportType('All'); setShowExportModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Download size={15} /> Export All
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700 dark:text-slate-200', bg: 'bg-white dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800' },
          { label: 'Eligible', value: stats.eligible, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50' },
          { label: 'Ineligible', value: stats.ineligible, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800/50' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4 text-center shadow-sm`}>
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, email or mobile…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none dark:text-white transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal size={15} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none dark:text-white transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Eligible">Eligible</option>
              <option value="Ineligible">Ineligible</option>
              <option value="Under consideration">Under consideration</option>
              <option value="Selected">Selected</option>
              <option value="Waitlisted">Waitlisted</option>
            </select>
            {(searchTerm || statusFilter !== 'All') && (
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('All'); }}
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear filters"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="px-5 py-3.5">#</th>
                <th className="px-5 py-3.5">Applicant</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Qualification</th>
                <th className="px-5 py-3.5">Experience</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={36} className="text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No candidates found matching the filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCandidates.map((c, idx) => (
                <React.Fragment key={c.summary.id}>
                  <tr className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${expandedRow === c.summary.id ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}>
                    <td className="px-5 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                          {c.summary.fullName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{c.summary.fullName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              {c.detail.category || 'General'} · {c.detail.gender || '—'}
                              {c.summary.meritRank && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded text-[10px] font-bold">
                                  Rank #{c.summary.meritRank}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        {c.detail.email || '—'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone size={11} className="text-slate-400 shrink-0" />
                        {c.summary.mobile}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[180px]">
                      <div className="flex items-start gap-1.5">
                        <BookOpen size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2" title={c.summary.qualification}>{c.summary.qualification || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[180px]">
                      <div className="flex items-start gap-1.5">
                        <Briefcase size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2" title={c.summary.experience}>{c.summary.experience || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <StatusBadge status={c.summary.screeningResult} />
                        {c.summary.outcome && c.summary.outcome !== c.summary.screeningResult && (
                          <StatusBadge status={c.summary.outcome} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setExpandedRow(expandedRow === c.summary.id ? null : c.summary.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          expandedRow === c.summary.id
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {expandedRow === c.summary.id ? <><ChevronUp size={14}/> Less</> : <><ChevronDown size={14}/> Details</>}
                      </button>
                    </td>
                  </tr>

                  {expandedRow === c.summary.id && (
                    <tr className="bg-gradient-to-r from-indigo-50/40 via-slate-50/20 to-slate-50/40 dark:from-indigo-950/20 dark:via-slate-800/10 dark:to-slate-800/10">
                      <td colSpan="7" className="px-5 py-5 border-l-4 border-indigo-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                          {/* Personal */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                              <User size={12} /> Personal Details
                            </h4>
                            <div className="space-y-2">
                              {[
                                ['Father/Husband', c.detail.fatherOrHusbandName],
                                ['Date of Birth', c.detail.dateOfBirth],
                                ['Nationality', c.detail.nationality],
                                ['Marital Status', c.detail.isMarried ? 'Married' : 'Single'],
                                ['ID Proof', c.detail.idProofType],
                                ['Category', c.detail.category],
                              ].map(([label, val]) => val ? (
                                <div key={label} className="flex items-start justify-between text-sm gap-2">
                                  <span className="text-slate-400 shrink-0">{label}</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{val}</span>
                                </div>
                              ) : null)}
                            </div>
                            {c.detail.gateNetGpatQualified && (
                              <>
                                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600 dark:text-violet-400 flex items-center gap-2 pt-2">
                                  <Award size={12} /> GATE / NET / GPAT
                                </h4>
                                <div className="space-y-2">
                                  {[
                                    ['Roll No', c.detail.gateNetGpatRollNo],
                                    ['Score', c.detail.gateNetGpatScore],
                                    ['Year', c.detail.gateNetGpatYear],
                                  ].map(([label, val]) => val ? (
                                    <div key={label} className="flex items-start justify-between text-sm gap-2">
                                      <span className="text-slate-400 shrink-0">{label}</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{val}</span>
                                    </div>
                                  ) : null)}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Research */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                              <BookOpen size={12} /> Research Output
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                ['SCI Journals', c.detail.sciJournalCount],
                                ['Scopus', c.detail.scopusJournalCount],
                                ['Non-SCI', c.detail.nonSciJournalCount],
                                ['Intl. Conf.', c.detail.internationalConfCount],
                                ['Natl. Conf.', c.detail.nationalConfCount],
                              ].map(([label, val]) => (
                                <div key={label} className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-center border border-slate-200 dark:border-slate-700">
                                  <div className="text-lg font-extrabold text-slate-800 dark:text-white">{val ?? 0}</div>
                                  <div className="text-[10px] text-slate-500 font-medium">{label}</div>
                                </div>
                              ))}
                            </div>

                            {c.summary.screeningRemarks && (
                              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Screening Remarks</p>
                                <p className="text-xs text-amber-800 dark:text-amber-300">{c.summary.screeningRemarks}</p>
                              </div>
                            )}
                          </div>

                          {/* Documents */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <FileText size={12} /> Documents
                              </h4>
                              <button
                                onClick={() => setViewModalTarget(c)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                              >
                                <Eye size={12} /> View Form
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                [c.detail.photoDocumentId, 'Photo'],
                                [c.detail.signatureDocumentId, 'Signature'],
                                [c.detail.idProofDocumentId, `ID (${c.detail.idProofType || 'Proof'})`],
                                [c.detail.gateNetGpatCertificateDocumentId, 'GATE Cert'],
                                [c.detail.publicationsDocumentId, 'Publications'],
                                [c.detail.categoryCertificateDocumentId, 'Category Cert'],
                                [c.detail.resumeDocumentId, 'Resume'],
                              ].filter(([id]) => id).map(([id, label]) => (
                                <button
                                  key={label}
                                  onClick={() => handleDownloadDoc(id, label)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
                                >
                                  <FileText size={11} className="text-indigo-500" /> {label}
                                </button>
                              ))}
                              {c.detail.education?.filter(e => e.certificateDocumentId).map((edu, i) => (
                                <button
                                  key={`edu-${i}`}
                                  onClick={() => handleDownloadDoc(edu.certificateDocumentId, `Education_${i}`)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                >
                                  <FileText size={11} className="text-emerald-500" />
                                  {edu.level === 'Other' ? edu.otherLevelName || edu.level : edu.level}
                                </button>
                              ))}
                              {c.detail.experiences?.filter(e => e.certificateDocumentId).map((exp, i) => (
                                <button
                                  key={`exp-${i}`}
                                  onClick={() => handleDownloadDoc(exp.certificateDocumentId, `Experience_${i}`)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                                >
                                  <Briefcase size={11} className="text-amber-500" /> {exp.organization}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {filteredCandidates.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{filteredCandidates.length}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{candidates.length}</span> candidates
            </p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-200">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export Columns</h3>
                <p className="text-xs text-slate-500 mt-0.5">Select the columns to include in your Excel export.</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 max-h-[55vh] overflow-y-auto">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectedColumns(EXCEL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {}))}
                  className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >Select All</button>
                <button
                  onClick={() => setSelectedColumns(EXCEL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: false }), {}))}
                  className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >Clear All</button>
              </div>
              <div className="space-y-1">
                {EXCEL_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedColumns[col.key]}
                      onChange={(e) => setSelectedColumns({ ...selectedColumns, [col.key]: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/30">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >Cancel</button>
              <button
                onClick={handleExportExcel}
                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
              >
                <Download size={15} /> Download Excel
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewCandidateApplicationModal
        isOpen={Boolean(viewModalTarget)}
        candidateId={viewModalTarget?.summary?.id}
        initialData={viewModalTarget?.detail}
        onClose={() => setViewModalTarget(null)}
      />
    </div>
  );
}
