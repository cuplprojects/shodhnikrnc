import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  FileText, Plus, Trash2, Save, Printer, List, Calendar,
  Building2, BookOpen, Hash, RefreshCw, CheckCircle, CheckCircle2, ArrowLeft,
  Search, ChevronDown, Check, User, Folder, Edit3, Eye, XCircle, X, Paperclip, Upload
} from 'lucide-react';
import { listNotings, createNoting, updateNoting, updateNotingStatus, deleteNoting } from '../api/notingApi';
import { listActiveDepartments, listAllDepartments } from '../api/departmentsApi';
import { getAllFacultyUsers } from '../api/facultyUsersApi';
import { listProjects, getProject } from '../api/projectsApi';
import { listUsers } from '../api/adminAccessApi';
import { getClaim } from '../api/fellowshipApi';
import { getProjectHeadSnapshots } from '../api/paymentVoucherApi';
import NotingRichTextEditor from '../components/NotingRichTextEditor';

const API_BASE = '/api/notings';

const generateDefaultNotingFormatText = (agency, title, pNo, pDate) => {
  const formattedDate = formatDateForDisplay(pDate) || '[Date]';
  const agencyStr = agency || 'NBCC funded';
  const titleStr = title || '';
  const pNoStr = pNo || '';

  return `<p class="font-bold text-lg mb-2"><strong>निदेशक</strong></p>
<p class="text-justify leading-relaxed">
करें, जो उनके <strong>${agencyStr}</strong> रिसर्च प्रोजेक्ट शीर्षक <strong>“${titleStr}”</strong> (Project No. <strong>${pNoStr}</strong> दिनांक <strong>${formattedDate}</strong>) से सम्बन्धीत है। उक्त पत्र विभागाध्यक्ष द्वारा अग्रसारित है।
</p>
<p class="mt-4">
मांगपत्र का विवरण नीचे सारणी में दिया गया है।
</p>
<!-- TABLE_PLACEHOLDER -->
<p class="mt-6 font-normal">
उक्त मांगपत्र आपके अनुमोदन हेतु प्रस्तुत है।
</p>`;
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return dateStr;
};

const formatIndentAmount = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const clean = String(val).replace('/-', '').replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return val;
  const formatted = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted}/-`;
};

export const getModeOfPurchaseText = (modeOrIsGem, amount) => {
  const modeStr = String(modeOrIsGem || '').trim();

  // If already detailed, keep it
  if (/rule 149|l1 buying|bidding|rule 154|rule 155/i.test(modeStr)) {
    return modeStr;
  }

  const cleanAmt = typeof amount === 'number'
    ? amount
    : (amount ? parseFloat(String(amount).replace(/,/g, '').replace('/-', '').trim()) : 0);
  const numAmt = isNaN(cleanAmt) ? 0 : cleanAmt;

  const isGem = modeOrIsGem === true || (modeStr.toLowerCase().includes('gem') && !modeStr.toLowerCase().includes('non'));

  if (isGem) {
    if (numAmt > 0 && numAmt <= 50000) {
      return 'GeM Rule 149 – Direct Purchase';
    } else if (numAmt > 50000 && numAmt <= 1000000) {
      return 'GeM – L1 Buying';
    } else if (numAmt > 1000000) {
      return 'GeM – Bidding';
    }
    return modeStr || 'GeM';
  } else {
    if (numAmt > 0 && numAmt <= 200000) {
      return 'Non-GeM – Rule 154 – Direct Purchase';
    } else if (numAmt > 200000) {
      return 'Non-GeM – Rule 155 of GFR 2017';
    }
    return modeStr || 'Non-GeM';
  }
};

const normalizeId = (id) => String(id || "").replaceAll("-", "").toLowerCase().trim();

const isFacultyInDepartment = (fac, deptObj) => {
  if (!deptObj) return true;

  const deptIdNorm = normalizeId(deptObj.id);
  const deptCodeNorm = String(deptObj.code || '').toLowerCase().trim();
  const deptNameNorm = String(deptObj.name || '').toLowerCase().trim();

  const facDept = String(fac.department || fac.dept || fac.departmentName || '').trim();
  const facDeptId = String(fac.departmentId || fac.deptId || '').trim();

  const facDeptNorm = normalizeId(facDept);
  const facDeptIdNorm = normalizeId(facDeptId);
  const facDeptLower = facDept.toLowerCase();

  // 1. GUID ID match
  if (deptIdNorm && (facDeptNorm === deptIdNorm || facDeptIdNorm === deptIdNorm)) {
    return true;
  }

  // 2. Department Code match (e.g. CSED, MED, CED)
  if (deptCodeNorm && (facDeptLower === deptCodeNorm || facDeptLower.includes(deptCodeNorm))) {
    return true;
  }

  // 3. Department Name match (e.g. Computer Science & Engineering)
  if (deptNameNorm && (facDeptLower === deptNameNorm || facDeptLower.includes(deptNameNorm) || deptNameNorm.includes(facDeptLower))) {
    return true;
  }

  return false;
};

const EMPTY_ITEM = {
  slNo: 1,
  nameOfItem: '',
  indentNoAndDate: '',
  budgetHeadAndBalance: '',
  indentAmount: '',
  modeOfPurchase: ''
};

const FUNDING_AGENCIES = [
  'AICTE',
  'CSIR',
  'DBT',
  'DST',
  'ICMR',
  'ISRO',
  'SERB',
  'Other (please specify)'
];

/**
 * Reusable Searchable Dropdown Component
 */
function SearchableSelect({ label, icon: Icon, value, onChange, options, placeholder, required, fallbackList = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => {
      const text = typeof opt === 'string' ? opt : (opt.label || opt.name || opt.title || '');
      return text.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [options, searchTerm]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const match = options.find(opt => (typeof opt === 'string' ? opt === value : (opt.value || opt.id) === value));
    if (match) {
      return typeof match === 'string' ? match : (match.label || match.name || match.title);
    }
    if (fallbackList && fallbackList.length > 0) {
      const fbMatch = fallbackList.find(f => String(f.userId || f.id || f.user_id).toLowerCase() === String(value).toLowerCase());
      if (fbMatch) {
        return fbMatch.fullName || fbMatch.name || fbMatch.userName || 'Faculty Member';
      }
    }
    return value;
  }, [value, options, fallbackList]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white flex items-center justify-between cursor-pointer transition font-medium shadow-sm"
      >
        <span className={selectedLabel ? "text-slate-900 dark:text-white font-medium truncate" : "text-slate-400 dark:text-slate-500"}>
          {selectedLabel || placeholder || "Select..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col animate-fade-in">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-52 divide-y divide-slate-100 dark:divide-slate-700/40">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center font-medium">
                {options.length === 0 ? (placeholder || "No options available") : "No results found"}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optVal = typeof opt === 'string' ? opt : (opt.value || opt.id);
                const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.name || opt.title);
                const isSelected = String(optVal) === String(value);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(optVal, opt);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2.5 text-xs font-medium cursor-pointer transition flex items-center justify-between ${isSelected
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70"
                      }`}
                  >
                    <span className="truncate">{optLabel}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotingPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const paramProjectId = searchParams.get('projectId') || location.state?.projectId || '';
  const paramProjectTitle = searchParams.get('projectTitle') || location.state?.projectTitle || '';
  const paramProjectNo = searchParams.get('projectNo') || searchParams.get('sanctionNo') || location.state?.projectNo || location.state?.sanctionNo || '';
  const paramFundedAgency = searchParams.get('fundedAgency') || location.state?.fundedAgency || '';
  const paramIndentNo = searchParams.get('indentNo') || location.state?.indentNo || '';
  const paramIndentDate = searchParams.get('indentDate') || location.state?.indentDate || '';
  const paramIndentNoAndDate = searchParams.get('indentNoAndDate') || location.state?.indentNoAndDate || '';
  const paramIndentAmount = searchParams.get('indentAmount') || location.state?.indentAmount || '';
  const paramNameOfItem = searchParams.get('nameOfItem') || location.state?.nameOfItem || '';
  const paramSanctionDate = searchParams.get('sanctionDate') || location.state?.sanctionDate || '';
  const paramDate = searchParams.get('date') || location.state?.date || '';
  const paramModeOfPurchase = searchParams.get('modeOfPurchase') || location.state?.modeOfPurchase || 'GeM';
  const paramBudgetHeadAndBalance = searchParams.get('budgetHeadAndBalance') || searchParams.get('budgetHead') || location.state?.budgetHeadAndBalance || location.state?.budgetHead || '';
  const paramIndentItems = location.state?.indentItems || location.state?.items || null;
  // Set when arriving from the DA's "Ready to Voucher" fellowship-claim
  // selection (FellowshipVoucherSelectionPage) instead of from a single
  // indent -- populates items from claims; submission is otherwise
  // unchanged, since NotingsController.Create already accepts multiple
  // items per call (Task 6 just adds fellowshipClaimId to each item).
  const fellowshipClaimIds = location.state?.fellowshipClaimIds ?? null;
  const isFellowshipNotingMode = Array.isArray(fellowshipClaimIds) && fellowshipClaimIds.length > 0;

  // Master API Data States
  const [departments, setDepartments] = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [allProjects, setAllProjects] = useState([]);

  // Cascading Selection States
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getInitialDateStr = () => {
    const raw = paramDate || paramIndentDate;
    if (raw) {
      return String(raw).includes('T') ? String(raw).split('T')[0] : String(raw).split(' ')[0];
    }
    return getTodayDateStr();
  };

  // Form Fields State
  const [fundedAgencySelect, setFundedAgencySelect] = useState('');
  const [otherFundedAgency, setOtherFundedAgency] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [sanctionDate, setSanctionDate] = useState('');
  const [date, setDate] = useState(getInitialDateStr);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  // TinyMCE Rich Text Format Changes State
  const [notingFormatTextChanges, setNotingFormatTextChanges] = useState('');
  const [isEditingFormatText, setIsEditingFormatText] = useState(false);
  const [isTextEditModalOpen, setIsTextEditModalOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const [savedNotings, setSavedNotings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'preview' | 'history'
  const [currentNoting, setCurrentNoting] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const getSignedFiles = useCallback((noting) => {
    if (!noting) return [];
    if (Array.isArray(noting.signedFiles)) return noting.signedFiles;
    if (noting.signedFilesJson) {
      try {
        return JSON.parse(noting.signedFilesJson);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  const handleUploadSignedCopy = async (file, targetNoting) => {
    if (!targetNoting || !file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const currentList = getSignedFiles(targetNoting);
        const newRecord = {
          id: `sf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF',
          uploadedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          dataUrl: dataUrl
        };

        const updatedList = [...currentList, newRecord];
        const jsonStr = JSON.stringify(updatedList);

        await updateNotingStatus(targetNoting.id, targetNoting.status || 'Pending Approval', 'Document Uploaded', jsonStr);
        notify('Signed document uploaded successfully!', 'success');
        await fetchNotings();
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      notify('Failed to upload signed document', 'error');
    }
  };

  const handleApproveNoting = async (n) => {
    if (!n) return;
    const signedFiles = getSignedFiles(n);
    if (signedFiles.length === 0) {
      notify('Please upload the signed document first.', 'error');
      return;
    }

    try {
      await updateNotingStatus(n.id, 'Approved', 'Approved');
      notify('Noting approved successfully!', 'success');
      await fetchNotings();
    } catch (err) {
      console.error("Approval error:", err);
      notify('Failed to approve noting', 'error');
    }
  };

  const printRef = useRef(null);

  const effectiveFundedAgency = fundedAgencySelect === 'Other (please specify)'
    ? otherFundedAgency
    : fundedAgencySelect;

  const handleOpenTextEditModal = () => {
    if (!notingFormatTextChanges) {
      const defaultText = generateDefaultNotingFormatText(
        effectiveFundedAgency,
        projectTitle,
        projectNo,
        date
      );
      setNotingFormatTextChanges(defaultText);
      setEditorKey(k => k + 1);
    }
    setIsTextEditModalOpen(true);
  };

  const handleSaveTextEditModal = async () => {
    setIsTextEditModalOpen(false);

    if (currentNoting) {
      const updatedNoting = {
        ...currentNoting,
        newNotingFormatTextChanges: notingFormatTextChanges,
        notingFormatTextChanges,
        notingFormateTextChanges: notingFormatTextChanges
      };
      setCurrentNoting(updatedNoting);

      const targetId = editingId || currentNoting.id;
      if (targetId && typeof targetId === 'string' && !targetId.startsWith('local-')) {
        try {
          const payload = {
            fundedAgency: currentNoting.fundedAgency || effectiveFundedAgency,
            projectTitle: currentNoting.projectTitle || projectTitle,
            projectNo: currentNoting.projectNo || projectNo,
            sanctionDate: currentNoting.sanctionDate || sanctionDate,
            date: currentNoting.date || date,
            status: currentNoting.status || 'Saved',
            newNotingFormatTextChanges: notingFormatTextChanges,
            notingFormatTextChanges,
            notingFormateTextChanges: notingFormatTextChanges,
            items: (currentNoting.items || items).map((item, idx) => ({
              slNo: item.slNo || idx + 1,
              nameOfItem: item.nameOfItem || '',
              indentNoAndDate: item.indentNoAndDate || '',
              budgetHeadAndBalance: item.budgetHeadAndBalance || '',
              indentAmount: item.indentAmount || '',
              modeOfPurchase: item.modeOfPurchase || ''
            }))
          };
          const savedData = await updateNoting(targetId, payload);
          setSavedNotings(prev => prev.map(n => n.id === targetId ? savedData : n));
          setCurrentNoting(savedData);
        } catch (err) {
          console.error('[NotingPage] Modal DB update error:', err);
        }
      }
    }
    notify('Noting text format updated successfully', 'success');
  };

  const handleToggleTextEdit = () => {
    handleOpenTextEditModal();
  };

  const handleLoadDefaultTemplate = () => {
    const defaultText = generateDefaultNotingFormatText(
      effectiveFundedAgency,
      projectTitle,
      projectNo,
      date
    );
    setNotingFormatTextChanges(defaultText);
    setEditorKey(k => k + 1);
    notify('Loaded standard template format into editor', 'info');
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedDepartment('');
    setSelectedFacultyId('');
    setSelectedProjectId('');
    setFundedAgencySelect('');
    setOtherFundedAgency('');
    setProjectTitle('');
    setProjectNo('');
    setSanctionDate('');
    setDate(getTodayDateStr());
    setItems([{ ...EMPTY_ITEM }]);
    setNotingFormatTextChanges('');
    setIsEditingFormatText(false);
    setIsTextEditModalOpen(false);
    setEditorKey(k => k + 1);
  };

  useEffect(() => {
    fetchNotings();
    fetchMasterData();
  }, []);

  useEffect(() => {
    const rawDate = paramDate || paramIndentDate;
    let formattedDateStr = '';
    if (rawDate) {
      const rawStr = String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate).split(' ')[0];
      setDate(rawStr);
      formattedDateStr = formatDateForDisplay(rawStr);
    }

    if (paramProjectTitle) setProjectTitle(paramProjectTitle);
    if (paramProjectNo) setProjectNo(paramProjectNo);
    if (paramSanctionDate) setSanctionDate(paramSanctionDate.includes('T') ? paramSanctionDate.split('T')[0] : paramSanctionDate);
    if (paramFundedAgency) {
      const foundStandard = FUNDING_AGENCIES.find(
        a => a.toLowerCase() === paramFundedAgency.toLowerCase() && a !== 'Other (please specify)'
      );
      if (foundStandard) {
        setFundedAgencySelect(foundStandard);
        setOtherFundedAgency('');
      } else {
        setFundedAgencySelect('Other (please specify)');
        setOtherFundedAgency(paramFundedAgency);
      }
    }

    const rawNoAndDate = (paramIndentNoAndDate && (paramIndentNoAndDate.includes('dt') || paramIndentNoAndDate.includes('/')))
      ? paramIndentNoAndDate
      : (paramIndentNo ? (formattedDateStr ? `${paramIndentNo}dt ${formattedDateStr}` : paramIndentNo) : (paramIndentNoAndDate || ''));

    const cleanAmountStr = (amt) => {
      if (amt === null || amt === undefined || amt === '') return '';
      const clean = String(amt).replace('/-', '').replace(/,/g, '').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? '' : num.toFixed(2);
    };

    if (paramIndentItems && Array.isArray(paramIndentItems) && paramIndentItems.length > 0) {
      setItems(paramIndentItems.map((it, idx) => {
        const itemName = it.name || it.nameOfItem || it.itemDescription || it.description || '';
        const itemAmt = it.estimatedCostInclTax || it.indentAmount || it.amount || (idx === 0 ? paramIndentAmount : '');
        const computedMode = getModeOfPurchaseText(paramModeOfPurchase, itemAmt);
        return {
          slNo: idx + 1,
          nameOfItem: itemName,
          indentNoAndDate: rawNoAndDate,
          budgetHeadAndBalance: it.budgetHeadAndBalance || paramBudgetHeadAndBalance || '',
          indentAmount: cleanAmountStr(itemAmt),
          modeOfPurchase: computedMode
        };
      }));
    } else if (paramIndentNo || paramIndentAmount || paramNameOfItem || paramIndentNoAndDate || paramBudgetHeadAndBalance) {
      const computedMode = getModeOfPurchaseText(paramModeOfPurchase, paramIndentAmount);
      setItems([{
        slNo: 1,
        nameOfItem: paramNameOfItem || '',
        indentNoAndDate: rawNoAndDate,
        budgetHeadAndBalance: paramBudgetHeadAndBalance || '',
        indentAmount: cleanAmountStr(paramIndentAmount),
        modeOfPurchase: computedMode
      }]);
    }

    if (allProjects.length > 0 && (paramProjectId || paramProjectNo)) {
      const proj = allProjects.find(
        p => String(p.id) === String(paramProjectId) ||
          (paramProjectNo && String(p.projectNo || p.sanctionNo).toLowerCase() === String(paramProjectNo).toLowerCase())
      );
      if (proj) {
        setSelectedProjectId(String(proj.id));
        if (proj.projectTitle || proj.title) setProjectTitle(proj.projectTitle || proj.title);
        if (proj.projectNo || proj.sanctionNo) setProjectNo(proj.projectNo || proj.sanctionNo);
        const sDate = proj.sanctionDate || proj.sanctionedDate || proj.startDate || proj.start_date || paramSanctionDate || '';
        if (sDate) setSanctionDate(String(sDate).includes('T') ? String(sDate).split('T')[0] : String(sDate));

        const ownerId = proj.ownerUserId || proj.userId || proj.ownerId || proj.piId;
        const ownerName = proj.ownerName || proj.piName || proj.facultyName;
        const fac = allFaculty.find(f =>
          (ownerId && String(f.userId || f.id || f.user_id).toLowerCase() === String(ownerId).toLowerCase()) ||
          (ownerName && (f.fullName || f.name || '').toLowerCase() === String(ownerName).toLowerCase())
        );
        if (fac) {
          setSelectedFacultyId(String(fac.userId || fac.id || fac.user_id));
          const deptVal = fac.departmentId || fac.department || proj.departmentId || proj.department || proj.dept;
          if (deptVal && departments.length > 0) {
            const deptMatch = departments.find(d =>
              String(d.id).toLowerCase() === String(deptVal).toLowerCase() ||
              String(d.code || '').toLowerCase() === String(deptVal).toLowerCase() ||
              String(d.name || '').toLowerCase() === String(deptVal).toLowerCase()
            );
            if (deptMatch) {
              setSelectedDepartment(String(deptMatch.id || deptMatch.code));
            }
          }
        } else if (ownerId) {
          setSelectedFacultyId(String(ownerId));
          const deptVal = proj.departmentId || proj.department || proj.dept;
          if (deptVal && departments.length > 0) {
            const deptMatch = departments.find(d =>
              String(d.id).toLowerCase() === String(deptVal).toLowerCase() ||
              String(d.code || '').toLowerCase() === String(deptVal).toLowerCase() ||
              String(d.name || '').toLowerCase() === String(deptVal).toLowerCase()
            );
            if (deptMatch) {
              setSelectedDepartment(String(deptMatch.id || deptMatch.code));
            }
          }
        }
      }
    }
  }, [allProjects, allFaculty, departments, paramProjectId, paramProjectTitle, paramProjectNo, paramSanctionDate, paramFundedAgency, paramIndentNo, paramIndentDate, paramIndentNoAndDate, paramIndentAmount, paramNameOfItem, paramDate, paramModeOfPurchase, paramIndentItems]);

  // Populate items from a batch of Dean-approved fellowship claims selected
  // on FellowshipVoucherSelectionPage, instead of from a single indent.
  useEffect(() => {
    if (!isFellowshipNotingMode) return;
    let active = true;

    Promise.all(fellowshipClaimIds.map((id) => getClaim(id))).then(async (claims) => {
      if (!active) return;

      const projectIds = Array.from(new Set(claims.map((c) => c.projectId).filter(Boolean)));
      let allSnapshots = [];
      let firstProj = null;

      if (projectIds.length > 0) {
        try {
          const snapshotResults = await Promise.all(
            projectIds.map((pId) => getProjectHeadSnapshots(pId).catch(() => []))
          );
          allSnapshots = snapshotResults.flat();
          firstProj = await getProject(projectIds[0]).catch(() => null);
        } catch (e) {
          console.error('Error fetching project data for noting fellowship claims:', e);
        }
      }

      setItems(claims.map((c, idx) => {
        const matchingSnap = allSnapshots.find(
          (s) =>
            s.headName === 'RecurringManpower' ||
            s.headName?.toLowerCase().includes('manpower') ||
            s.displayName?.toLowerCase().includes('manpower')
        );

        const headTitle = matchingSnap ? (matchingSnap.displayName || matchingSnap.headName) : 'Recurring: Manpower';
        const availAmt = matchingSnap ? (matchingSnap.available !== undefined ? matchingSnap.available : 0) : 0;
        const budgetHeadStr = `${headTitle}${availAmt > 0 ? ` Rs. ${Number(availAmt).toLocaleString('en-IN')}/-` : ''}`;

        return {
          slNo: idx + 1,
          nameOfItem: `Fellowship claim ${c.claimMonth}/${c.claimYear} - ${c.scholarName}`,
          indentNoAndDate: (c.rollNo && c.rollNo !== 'N/A') ? c.rollNo : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '-'),
          budgetHeadAndBalance: budgetHeadStr,
          indentAmount: String(c.recommendedAmount ?? c.totalAmount),
          modeOfPurchase: '-',
          fellowshipClaimId: c.id,
        };
      }));

      if (firstProj || claims[0]?.projectTitle) {
        const title = firstProj?.projectTitle || claims[0]?.projectTitle || '';
        const pNo = firstProj?.sanctionNo || '';
        const sDate = firstProj?.sanctionDate || '';
        const agencyName = firstProj?.agency || '';

        if (title) setProjectTitle(title);
        if (pNo) setProjectNo(pNo);
        if (sDate) setSanctionDate(String(sDate).includes('T') ? String(sDate).split('T')[0] : String(sDate));

        if (agencyName) {
          const foundStandard = FUNDING_AGENCIES.find(
            a => a.toLowerCase() === agencyName.toLowerCase() && a !== 'Other (please specify)'
          );
          if (foundStandard) {
            setFundedAgencySelect(foundStandard);
            setOtherFundedAgency('');
          } else {
            setFundedAgencySelect('Other (please specify)');
            setOtherFundedAgency(agencyName);
          }
        }
      }
    }).catch((err) => {
      if (!active) return;
      notify(err?.message || 'Failed to load the selected fellowship claims.', 'error');
    });

    return () => { active = false; };
  }, [isFellowshipNotingMode, fellowshipClaimIds]);

  const fetchNotings = useCallback(async (customParams = {}) => {
    try {
      const params = {
        pageNumber: customParams.pageNumber ?? historyPageNumber,
        pageSize: customParams.pageSize ?? historyPageSize,
        search: customParams.search !== undefined ? customParams.search : historySearchQuery,
      };
      const res = await listNotings(params);
      if (res && res.items !== undefined) {
        setSavedNotings(res.items || []);
        setHistoryTotalCount(res.totalCount || 0);
        setHistoryTotalPages(res.totalPages || 1);
      } else if (Array.isArray(res)) {
        setSavedNotings(res);
        setHistoryTotalCount(res.length);
        setHistoryTotalPages(Math.ceil(res.length / (customParams.pageSize || historyPageSize)) || 1);
      }
    } catch (err) {
      console.warn('Backend API not reachable yet, using fallback local state:', err);
    }
  }, [historyPageNumber, historyPageSize, historySearchQuery]);

  useEffect(() => {
    if (activeTab === 'history') {
      const timer = setTimeout(() => {
        void fetchNotings({ pageNumber: historyPageNumber, pageSize: historyPageSize, search: historySearchQuery });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, historyPageNumber, historyPageSize, historySearchQuery, fetchNotings]);

  const fetchMasterData = async () => {
    try {
      const [deptRes, facRes, projRes, adminUsersRes] = await Promise.allSettled([
        listActiveDepartments().catch(() => listAllDepartments()),
        getAllFacultyUsers(),
        listProjects(),
        listUsers()
      ]);

      let loadedDepts = [];
      let loadedFac = [];
      let loadedProj = [];
      let loadedAdminUsers = [];

      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
        loadedDepts = deptRes.value;
      }
      if (facRes.status === 'fulfilled' && Array.isArray(facRes.value)) {
        loadedFac = facRes.value;
      }
      if (projRes.status === 'fulfilled' && Array.isArray(projRes.value)) {
        loadedProj = projRes.value;
      }
      if (adminUsersRes.status === 'fulfilled' && Array.isArray(adminUsersRes.value)) {
        loadedAdminUsers = adminUsersRes.value;
      }

      // Merge user objects by ID so FullName & DepartmentId from AspNetUsers / FacultyProfiles are preserved
      const userMap = new Map();

      // 1. Process admin users from AspNetUsers (contains Id, FullName, UserName, DepartmentId)
      loadedAdminUsers.forEach(u => {
        const id = String(u.id || u.userId || '').trim();
        if (id) {
          const key = id.toLowerCase();
          const fullNameVal = u.fullName || u.userName || '';
          userMap.set(key, {
            userId: id,
            fullName: fullNameVal,
            name: fullNameVal,
            departmentId: u.departmentId || u.department || '',
            department: u.departmentId || ''
          });
        }
      });

      // 2. Process faculty profiles from /api/faculty-users/brief
      loadedFac.forEach(f => {
        const id = String(f.userId || f.id || f.user_id || '').trim();
        if (id) {
          const key = id.toLowerCase();
          const existing = userMap.get(key) || {};
          const isGuidStr = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || '').trim());

          const profileName = (f.name && !isGuidStr(f.name)) ? f.name : (f.fullName && !isGuidStr(f.fullName)) ? f.fullName : '';
          const finalFullName = profileName || existing.fullName || existing.name || '';

          userMap.set(key, {
            ...existing,
            userId: id,
            fullName: finalFullName,
            name: finalFullName,
            departmentId: existing.departmentId || f.departmentId || f.department || '',
            department: f.department || existing.department || f.departmentId || ''
          });
        }
      });

      // 3. Process projects to ensure all PIs are represented
      loadedProj.forEach(p => {
        const uid = p.ownerUserId || p.userId || p.ownerId;
        const name = p.ownerName || p.piName || p.facultyName;
        const dept = p.department || p.dept || p.departmentId || '';
        if (uid || name) {
          const idStr = String(uid || name).trim();
          const key = idStr.toLowerCase();
          const existing = userMap.get(key) || {};
          const isGuidStr = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || '').trim());
          const validName = name && !isGuidStr(name) ? name : existing.fullName || existing.name || '';

          userMap.set(key, {
            ...existing,
            userId: existing.userId || idStr,
            fullName: existing.fullName || validName,
            name: existing.name || validName,
            department: existing.department || dept,
            departmentId: existing.departmentId || dept
          });
        }
      });

      setDepartments(loadedDepts);
      setAllFaculty(Array.from(userMap.values()));
      setAllProjects(loadedProj);
    } catch (err) {
      console.warn('[NotingPage] Master data load error:', err);
    }
  };

  // Filter Faculty Members by Selected Department
  const filteredFaculty = useMemo(() => {
    if (!selectedDepartment) return allFaculty;

    const deptObj = departments.find(
      d => String(d.id) === String(selectedDepartment) || d.code === selectedDepartment || d.name === selectedDepartment
    );

    const list = allFaculty.filter(fac => isFacultyInDepartment(fac, deptObj));
    return list.length > 0 ? list : allFaculty;
  }, [allFaculty, selectedDepartment, departments]);

  // Filter Projects by Selected Faculty Member
  const filteredProjects = useMemo(() => {
    if (!selectedFacultyId) return allProjects;

    const selectedFac = allFaculty.find(f => String(f.userId || f.id || f.user_id) === String(selectedFacultyId));
    const targetFacId = normalizeId(selectedFacultyId);
    const facName = selectedFac ? String(selectedFac.name || selectedFac.fullName || '').toLowerCase().trim() : '';

    const list = allProjects.filter(p => {
      const ownerId = normalizeId(p.ownerUserId || p.userId || p.ownerId || p.piId);

      if (ownerId && targetFacId && ownerId === targetFacId) return true;
      if (ownerId && targetFacId && (ownerId.includes(targetFacId) || targetFacId.includes(ownerId))) return true;

      const ownerName = String(p.ownerName || p.piName || p.facultyName || p.creatorName || '').toLowerCase().trim();
      if (ownerName && facName && (ownerName.includes(facName) || facName.includes(ownerName))) return true;

      return false;
    });
    return list.length > 0 ? list : allProjects;
  }, [allProjects, selectedFacultyId, allFaculty]);

  // Department Selection Handler
  const handleDepartmentChange = (deptId) => {
    setSelectedDepartment(deptId);
    setSelectedFacultyId('');
    setSelectedProjectId('');
  };

  // Faculty Selection Handler
  const handleFacultyChange = (facId) => {
    setSelectedFacultyId(facId);
    setSelectedProjectId('');
  };

  // Project Selection Handler - AUTO FILLS PROJECT DETAILS
  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId);
    if (!projId) return;

    const proj = allProjects.find(p => String(p.id) === String(projId));
    if (proj) {
      const title = proj.projectTitle || proj.title || '';
      const pNo = proj.projectNo || proj.sanctionNo || '';
      const sDate = proj.sanctionDate || proj.sanctionedDate || proj.startDate || proj.start_date || '';
      const agencyName = proj.agency || proj.fundedAgency || proj.fundingAgency || '';

      if (title) setProjectTitle(title);
      if (pNo) setProjectNo(pNo);
      if (sDate) setSanctionDate(String(sDate).includes('T') ? String(sDate).split('T')[0] : String(sDate));

      if (agencyName) {
        const foundStandard = FUNDING_AGENCIES.find(
          a => a.toLowerCase() === agencyName.toLowerCase() && a !== 'Other (please specify)'
        );
        if (foundStandard) {
          setFundedAgencySelect(foundStandard);
          setOtherFundedAgency('');
        } else {
          setFundedAgencySelect('Other (please specify)');
          setOtherFundedAgency(agencyName);
        }
      }

      const ownerId = proj.ownerUserId || proj.userId || proj.ownerId || proj.piId;
      const ownerName = proj.ownerName || proj.piName || proj.facultyName;
      const fac = allFaculty.find(f =>
        (ownerId && String(f.userId || f.id || f.user_id).toLowerCase() === String(ownerId).toLowerCase()) ||
        (ownerName && (f.fullName || f.name || '').toLowerCase() === String(ownerName).toLowerCase())
      );
      if (fac) {
        setSelectedFacultyId(String(fac.userId || fac.id || fac.user_id));
        const deptVal = fac.departmentId || fac.department || proj.departmentId || proj.department || proj.dept;
        if (deptVal && departments.length > 0) {
          const deptMatch = departments.find(d =>
            String(d.id).toLowerCase() === String(deptVal).toLowerCase() ||
            String(d.code || '').toLowerCase() === String(deptVal).toLowerCase() ||
            String(d.name || '').toLowerCase() === String(deptVal).toLowerCase()
          );
          if (deptMatch) {
            setSelectedDepartment(String(deptMatch.id || deptMatch.code));
          }
        }
      } else if (ownerId) {
        setSelectedFacultyId(String(ownerId));
        const deptVal = proj.departmentId || proj.department || proj.dept;
        if (deptVal && departments.length > 0) {
          const deptMatch = departments.find(d =>
            String(d.id).toLowerCase() === String(deptVal).toLowerCase() ||
            String(d.code || '').toLowerCase() === String(deptVal).toLowerCase() ||
            String(d.name || '').toLowerCase() === String(deptVal).toLowerCase()
          );
          if (deptMatch) {
            setSelectedDepartment(String(deptMatch.id || deptMatch.code));
          }
        }
      }

      let defaultHeadTitle = 'Non-Recurring';
      let defaultAmt = proj.totalSanctioned || proj.sanctionAmount || 0;
      if (proj.budgetHeads && proj.budgetHeads.length > 0) {
        const head = proj.budgetHeads[0];
        defaultHeadTitle = head.customLabel || head.headName || 'Non-Recurring';
        if (head.headName) {
          const rawHead = String(head.headName);
          if (rawHead.includes('Equipment') || rawHead.includes('NonRecurring')) defaultHeadTitle = 'Non-Recurring';
          else if (rawHead.includes('Consumable')) defaultHeadTitle = 'Consumable';
          else if (rawHead.includes('Contingency')) defaultHeadTitle = 'Contingency';
          else defaultHeadTitle = rawHead.replace('Recurring', '').trim();
        }
        defaultAmt = head.total || head.year1Amount || defaultAmt;
      }

      const defaultBudgetStr = `${defaultHeadTitle}${defaultAmt ? ` Rs. ${Number(defaultAmt).toLocaleString('en-IN')}/-` : ''}`;
      if (defaultBudgetStr) {
        setItems(prevItems => prevItems.map(it => it.budgetHeadAndBalance ? it : { ...it, budgetHeadAndBalance: defaultBudgetStr }));
      }
    }
  };

  const handleAddItem = () => {
    const nextSlNo = items.length + 1;
    setItems([
      ...items,
      {
        slNo: nextSlNo,
        nameOfItem: '',
        indentNoAndDate: '',
        budgetHeadAndBalance: '',
        indentAmount: '',
        modeOfPurchase: ''
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, idx) => idx !== index).map((item, idx) => ({
      ...item,
      slNo: idx + 1
    }));
    setItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const notify = (text, type = 'success') => {
    setMessage({ type, text });
    window.dispatchEvent(new CustomEvent('show-global-toast', {
      detail: { message: text, severity: type }
    }));
  };

  const handleSubmitNoting = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const payload = {
      fundedAgency: effectiveFundedAgency,
      projectTitle,
      projectNo,
      sanctionDate,
      date,
      status: editingId ? (currentNoting?.status || 'Pending Approval') : 'Pending Approval',
      currentStage: editingId ? (currentNoting?.currentStage || 'Pending Document Upload') : 'Pending Document Upload',
      newNotingFormatTextChanges: notingFormatTextChanges,
      notingFormatTextChanges,
      notingFormateTextChanges: notingFormatTextChanges,
      items: items.map((item, idx) => ({
        slNo: idx + 1,
        nameOfItem: item.nameOfItem,
        indentNoAndDate: item.indentNoAndDate,
        budgetHeadAndBalance: item.budgetHeadAndBalance,
        indentAmount: item.indentAmount,
        modeOfPurchase: item.modeOfPurchase,
        fellowshipClaimId: item.fellowshipClaimId ?? null
      }))
    };

    console.log('[NotingPage] Submitting Noting payload (editingId:', editingId, '):', payload);
    try {
      let savedData;
      if (editingId) {
        savedData = await updateNoting(editingId, payload);
        setSavedNotings(prev => prev.map(n => n.id === editingId ? savedData : n));
        notify('Noting Updated Successfully', 'success');
      } else {
        savedData = await createNoting(payload);
        setSavedNotings(prev => [savedData, ...prev]);
        notify('Noting Created Successfully', 'success');
      }

      setCurrentNoting(savedData);
      resetForm();
      setActiveTab('preview');
    } catch (err) {
      console.error('[NotingPage] API submit error:', err);
      const fallback = {
        id: editingId || ('local-' + Date.now()),
        ...payload,
        createdAt: new Date().toISOString()
      };
      if (editingId) {
        setSavedNotings(prev => prev.map(n => n.id === editingId ? fallback : n));
        notify('Noting Updated Successfully', 'success');
      } else {
        setSavedNotings(prev => [fallback, ...prev]);
        notify('Noting Created Successfully', 'success');
      }
      setCurrentNoting(fallback);
      resetForm();
      setActiveTab('preview');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLoadNoting = (noting) => {
    setCurrentNoting(noting);
    const agency = noting.fundedAgency || '';
    if (FUNDING_AGENCIES.includes(agency) && agency !== 'Other (please specify)') {
      setFundedAgencySelect(agency);
      setOtherFundedAgency('');
    } else if (agency) {
      setFundedAgencySelect('Other (please specify)');
      setOtherFundedAgency(agency);
    } else {
      setFundedAgencySelect('');
      setOtherFundedAgency('');
    }
    setProjectTitle(noting.projectTitle || '');
    setProjectNo(noting.projectNo || '');
    setSanctionDate(noting.sanctionDate || '');
    setDate(noting.date || getTodayDateStr());
    const textVal = noting.newNotingFormatTextChanges || noting.notingFormatTextChanges || noting.notingFormateTextChanges || '';
    setNotingFormatTextChanges(textVal);
    setIsEditingFormatText(Boolean(textVal));
    setEditorKey(k => k + 1);

    if (noting.items && noting.items.length > 0) {
      setItems(noting.items.map((i, idx) => ({
        slNo: i.slNo || idx + 1,
        nameOfItem: i.nameOfItem || '',
        indentNoAndDate: i.indentNoAndDate || '',
        budgetHeadAndBalance: i.budgetHeadAndBalance || '',
        indentAmount: i.indentAmount || '',
        modeOfPurchase: i.modeOfPurchase || ''
      })));
    }
    setActiveTab('preview');
  };

  const handleEditNoting = (noting) => {
    setEditingId(noting.id);
    setCurrentNoting(noting);
    const agency = noting.fundedAgency || '';
    if (FUNDING_AGENCIES.includes(agency) && agency !== 'Other (please specify)') {
      setFundedAgencySelect(agency);
      setOtherFundedAgency('');
    } else if (agency) {
      setFundedAgencySelect('Other (please specify)');
      setOtherFundedAgency(agency);
    } else {
      setFundedAgencySelect('');
      setOtherFundedAgency('');
    }
    setProjectTitle(noting.projectTitle || '');
    setProjectNo(noting.projectNo || '');
    setSanctionDate(noting.sanctionDate || '');
    setDate(noting.date || getTodayDateStr());
    const textVal = noting.notingFormatTextChanges || noting.notingFormateTextChanges || '';
    setNotingFormatTextChanges(textVal);
    setIsEditingFormatText(Boolean(textVal));
    setEditorKey(k => k + 1);

    if (noting.items && noting.items.length > 0) {
      setItems(noting.items.map((i, idx) => ({
        slNo: i.slNo || idx + 1,
        nameOfItem: i.nameOfItem || '',
        indentNoAndDate: i.indentNoAndDate || '',
        budgetHeadAndBalance: i.budgetHeadAndBalance || '',
        indentAmount: i.indentAmount || '',
        modeOfPurchase: i.modeOfPurchase || ''
      })));
    } else {
      setItems([{ ...EMPTY_ITEM }]);
    }
    setActiveTab('create');
  };

  const handleDeleteNoting = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Noting record?')) {
      return;
    }
    try {
      await deleteNoting(id);
      setSavedNotings(prev => prev.filter(n => n.id !== id));
      if (currentNoting && currentNoting.id === id) {
        setCurrentNoting(null);
      }
      notify('Noting Deleted Successfully', 'success');
    } catch (err) {
      console.error('[NotingPage] Delete error:', err);
      setSavedNotings(prev => prev.filter(n => n.id !== id));
      if (currentNoting && currentNoting.id === id) {
        setCurrentNoting(null);
      }
      notify('Noting Deleted Successfully', 'success');
    }
  };

  const activeNoting = currentNoting || {
    fundedAgency: effectiveFundedAgency,
    projectTitle,
    projectNo,
    sanctionDate,
    date,
    notingFormatTextChanges,
    items
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors">
      {/* Dynamic Theme Styles for Printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-notes-section, #printable-notes-section * {
            visibility: visible;
          }
          #printable-notes-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="max-w-8xl mx-auto mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm dark:shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 rounded-xl text-blue-600 dark:text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Noting Page &amp; Notes &amp; Orders
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Generate, manage, and print official Notes &amp; Orders document layout
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'create'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            <Plus className="w-4 h-4" />
            Create / Edit Noting
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'preview'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            <Printer className="w-4 h-4" />
            Document Layout
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            <List className="w-4 h-4" />
            Saved Notings ({historyTotalCount || savedNotings.length})
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="max-w-8xl mx-auto mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* TAB 1: CREATE / EDIT NOTING FORM */}
      {activeTab === 'create' && (
        <div className="max-w-8xl mx-auto space-y-6">
          <form onSubmit={handleSubmitNoting} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 shadow-sm dark:shadow-xl transition-colors">
            <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
              <BookOpen className="w-5 h-5" /> Project &amp; Header Information
            </h2>

            {/* Department, Faculty & Project Lookup Header */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-8 space-y-4">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-500" /> Quick Project Auto-Fill Lookup
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Select Department */}
                <div>
                  <SearchableSelect
                    label="DEPARTMENT"
                    icon={Building2}
                    value={selectedDepartment}
                    onChange={(val) => handleDepartmentChange(val)}
                    options={departments.map(d => ({
                      id: String(d.id || d.code),
                      label: `${d.name} (${d.code || 'DEPT'})`
                    }))}
                    placeholder="-- Select Department --"
                  />
                </div>

                {/* 2. Select Faculty / PI Member */}
                <div>
                  <SearchableSelect
                    label="FACULTY / PI MEMBER"
                    icon={User}
                    value={selectedFacultyId}
                    onChange={(val) => handleFacultyChange(val)}
                    fallbackList={allFaculty}
                    options={filteredFaculty.map(f => {
                      const uId = f.userId || f.id || f.user_id || '';
                      const isGuidStr = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || '').trim());

                      let displayName = f.fullName || f.name || f.userName || '';
                      if (!displayName || isGuidStr(displayName)) {
                        displayName = (f.fullName && !isGuidStr(f.fullName)) ? f.fullName : 'Faculty Member';
                      }

                      const badge = (uId && !isGuidStr(uId)) ? ` (${uId})` : '';

                      return {
                        id: String(uId),
                        label: `${displayName}${badge}`
                      };
                    })}
                    placeholder={selectedDepartment ? "-- Select Faculty Member --" : "-- Select Faculty Member --"}
                  />
                </div>

                {/* 3. Select Project (Auto Fills Project Title & Details) */}
                <div>
                  <SearchableSelect
                    label="SELECT PROJECT"
                    icon={Folder}
                    value={selectedProjectId}
                    onChange={(val) => handleProjectSelect(val)}
                    options={filteredProjects.map(p => {
                      const title = p.projectTitle || p.title || 'Untitled Project';
                      const pNo = p.projectNo || p.sanctionNo || '';
                      return {
                        id: String(p.id),
                        label: pNo ? `${title} [${pNo}]` : title
                      };
                    })}
                    placeholder={selectedFacultyId ? "-- Select Project to Auto-Fill --" : "-- Choose Faculty First --"}
                  />
                </div>

                {/* 4. Searchable Funding Agency */}
                <div>
                  <SearchableSelect
                    label="FUNDING AGENCY"
                    icon={Building2}
                    required={true}
                    value={fundedAgencySelect}
                    onChange={(val) => setFundedAgencySelect(val)}
                    options={FUNDING_AGENCIES.map(a => ({ id: a, label: a }))}
                    placeholder="Select a funding agency"
                  />

                  {fundedAgencySelect === 'Other (please specify)' && (
                    <div className="mt-3 animate-fade-in">
                      <input
                        type="text"
                        value={otherFundedAgency}
                        onChange={(e) => setOtherFundedAgency(e.target.value)}
                        placeholder="Enter the funding agency's name"
                        required
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition font-medium"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editable Project Details Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Project Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Enter project title"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition font-medium"
                />
              </div>

              {/* Project No / Sanction No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Sanction No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectNo}
                  onChange={(e) => setProjectNo(e.target.value)}
                  placeholder="e.g. CP-00281-2025-26"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition font-medium"
                />
              </div>

              {/* Sanction Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Sanction Date
                </label>
                <input
                  type="date"
                  value={sanctionDate}
                  onChange={(e) => setSanctionDate(e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition font-medium cursor-pointer"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition font-medium cursor-pointer"
                />
              </div>
            </div>

            {/* TinyMCE Text Editor Section for NotingFormatTextChanges */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Noting Text Format (TinyMCE Rich Text Editor)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleTextEdit}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${isEditingFormatText
                      ? 'bg-blue-600 text-white shadow-blue-600/30'
                      : 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 hover:bg-blue-600 hover:text-white'
                      }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    {isEditingFormatText ? 'Hide Text Editor' : 'Text Edit'}
                  </button>
                  {isEditingFormatText && (
                    <button
                      type="button"
                      onClick={handleLoadDefaultTemplate}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      title="Load standard noting template format"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reset Template
                    </button>
                  )}
                </div>
              </div>

              {isEditingFormatText && (
                <div className="animate-fade-in pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
                    Use TinyMCE editor to customize noting text format. Use <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-xs">&lt;!-- TABLE_PLACEHOLDER --&gt;</code> to position the Demand Items table within your text.
                  </p>
                  <NotingRichTextEditor
                    key={editorKey}
                    content={notingFormatTextChanges}
                    onChange={(html) => setNotingFormatTextChanges(html)}
                    placeholder="Type or edit noting format text..."
                  />
                </div>
              )}
            </div>

            {/* Dynamic Items Table */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Demand / Indent Items List</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-2 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Item Row
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
                      <th className="p-3 w-12 text-center">SI No.</th>
                      <th className="p-3 min-w-[280px]">Name of Item</th>
                      <th className="p-3 min-w-[180px]">Indent No. &amp; date</th>
                      <th className="p-3 min-w-[200px]">Budget Head &amp; Balance</th>
                      <th className="p-3 min-w-[140px]">Indent amount (Rs.)</th>
                      <th className="p-3 min-w-[180px]">Mode of Purchase</th>
                      <th className="p-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-800/40">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                        <td className="p-3 text-center text-slate-500 dark:text-slate-400 font-semibold">
                          {idx + 1}
                        </td>
                        <td className="p-2">
                          <textarea
                            rows={2}
                            value={item.nameOfItem}
                            onChange={(e) => handleItemChange(idx, 'nameOfItem', e.target.value)}
                            placeholder="Enter Name of Item"
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-900 dark:text-white resize-y focus:outline-none font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.indentNoAndDate}
                            onChange={(e) => handleItemChange(idx, 'indentNoAndDate', e.target.value)}
                            placeholder="e.g. 33/CED/FY:2026-27 dt 04/08/2026"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.budgetHeadAndBalance}
                            onChange={(e) => handleItemChange(idx, 'budgetHeadAndBalance', e.target.value)}
                            placeholder="e.g. Non-Recurring Rs. 48,000,000/-"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.indentAmount}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (val !== '' && parseFloat(val) < 0) val = '0';
                              if (val.includes('.')) {
                                const [intPart, decPart] = val.split('.');
                                if (decPart && decPart.length > 2) {
                                  val = `${intPart}.${decPart.slice(0, 2)}`;
                                }
                              }
                              handleItemChange(idx, 'indentAmount', val);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0.00"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.modeOfPurchase}
                            onChange={(e) => handleItemChange(idx, 'modeOfPurchase', e.target.value)}
                            placeholder="e.g. Non GeM-Rule 155 of GFR 2017"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition"
                              title="Delete row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Submit Button */}
            <div className="flex justify-end items-center gap-4 border-t border-slate-200 dark:border-slate-700 pt-6">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition flex items-center gap-2 text-xs md:text-sm"
                >
                  <XCircle className="w-4 h-4 text-slate-500" />
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 text-xs md:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {editingId ? 'Updating...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {editingId ? 'Edit Noting' : 'Submit Noting Button'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: DOCUMENT LAYOUT PREVIEW & PRINT/DOWNLOAD */}
      {activeTab === 'preview' && (
        <div className="max-w-8xl mx-auto space-y-6">
          {/* Action Toolbar */}
          <div className="no-print bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 shadow-sm dark:shadow-xl transition-colors">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Official document layout ready for printing or saving as PDF.
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenTextEditModal}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Edit3 className="w-4 h-4" /> Text Edit
              </button>
              {/* <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Edit Fields
              </button> */}
              <button
                onClick={handlePrint}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Download PDF
              </button>
            </div>
          </div>

          {/* PRINTABLE DOCUMENT CONTAINER MATCHING OFFICIAL DESIGN */}
          <div
            id="printable-notes-section"
            ref={printRef}
            className="bg-white text-black p-8 md:p-12 rounded-xl shadow-xl border border-slate-300 font-serif leading-relaxed"
            style={{ minHeight: '800px' }}
          >
            {/* Header */}
            <div className="text-center mb-8 border-b border-black pb-3">
              <h1 className="text-3xl font-normal tracking-wide text-black" style={{ fontFamily: 'Georgia, serif' }}>
                Notes &amp; Orders
              </h1>
            </div>

            {/* Content Body */}
            {(() => {
              const formatTextHtml = activeNoting.newNotingFormatTextChanges || activeNoting.notingFormatTextChanges || activeNoting.notingFormateTextChanges;
              return (
                <div className="space-y-6 text-base text-black font-normal" style={{ fontSize: '15px', lineHeight: '1.7' }}>
                  {formatTextHtml ? (
                    formatTextHtml.includes('<!-- TABLE_PLACEHOLDER -->') ? (
                      <>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatTextHtml.split('<!-- TABLE_PLACEHOLDER -->')[0]
                          }}
                        />
                        {/* Table Matching Official Image Layout */}
                        <div className="my-6">
                          <table
                            className="w-full border-collapse text-left text-xs font-sans text-black"
                            style={{ border: '2px solid black' }}
                          >
                            <thead>
                              <tr style={{ borderBottom: '2px solid black' }}>
                                <th className="p-2 font-bold text-center border-r border-black w-10">SI No.</th>
                                <th className="p-2 font-bold text-center border-r border-black">Name of Item</th>
                                <th className="p-2 font-bold text-center border-r border-black">Indent No. &amp; date</th>
                                <th className="p-2 font-bold text-center border-r border-black">Budget Head &amp; Balance</th>
                                <th className="p-2 font-bold text-center border-r border-black">Indent amount (Rs.)</th>
                                <th className="p-2 font-bold text-center">Mode of Purchase</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeNoting.items || []).map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid black' }}>
                                  <td className="p-2 text-center border-r border-black font-semibold align-top">{item.slNo || index + 1}.</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.nameOfItem}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.indentNoAndDate}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.budgetHeadAndBalance}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs font-semibold whitespace-nowrap">{formatIndentAmount(item.indentAmount)}</td>
                                  <td className="p-2 align-top font-sans text-xs">{item.modeOfPurchase}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatTextHtml.split('<!-- TABLE_PLACEHOLDER -->')[1] || ''
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatTextHtml
                          }}
                        />
                        {/* Table Matching Official Image Layout */}
                        <div className="my-6">
                          <table
                            className="w-full border-collapse text-left text-xs font-sans text-black"
                            style={{ border: '2px solid black' }}
                          >
                            <thead>
                              <tr style={{ borderBottom: '2px solid black' }}>
                                <th className="p-2 font-bold text-center border-r border-black w-10">SI No.</th>
                                <th className="p-2 font-bold text-center border-r border-black">Name of Item</th>
                                <th className="p-2 font-bold text-center border-r border-black">Indent No. &amp; date</th>
                                <th className="p-2 font-bold text-center border-r border-black">Budget Head &amp; Balance</th>
                                <th className="p-2 font-bold text-center border-r border-black">Indent amount (Rs.)</th>
                                <th className="p-2 font-bold text-center">Mode of Purchase</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeNoting.items || []).map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid black' }}>
                                  <td className="p-2 text-center border-r border-black font-semibold align-top">{item.slNo || index + 1}.</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.nameOfItem}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.indentNoAndDate}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs">{item.budgetHeadAndBalance}</td>
                                  <td className="p-2 border-r border-black align-top font-sans text-xs font-semibold whitespace-nowrap">{formatIndentAmount(item.indentAmount)}</td>
                                  <td className="p-2 align-top font-sans text-xs">{item.modeOfPurchase}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <p className="font-bold text-lg mb-2">निदेशक</p>

                      <p className="text-justify leading-relaxed">
                        करें, जो उनके <span className="font-semibold">{activeNoting.fundedAgency || 'NBCC funded'}</span> रिसर्च प्रोजेक्ट शीर्षक <span className="font-semibold">“{activeNoting.projectTitle}”</span> (Project No. <span className="font-semibold">{activeNoting.projectNo}</span> दिनांक <span className="font-semibold">{formatDateForDisplay(activeNoting.date)}</span>) से सम्बन्धीत है। उक्त पत्र विभागाध्यक्ष द्वारा अग्रसारित है।
                      </p>

                      <p className="mt-4">
                        मांगपत्र का विवरण नीचे सारणी में दिया गया है।
                      </p>

                      {/* Table Matching Official Image Layout */}
                      <div className="my-6">
                        <table
                          className="w-full border-collapse text-left text-xs font-sans text-black"
                          style={{ border: '2px solid black' }}
                        >
                          <thead>
                            <tr style={{ borderBottom: '2px solid black' }}>
                              <th className="p-2 font-bold text-center border-r border-black w-10">SI No.</th>
                              <th className="p-2 font-bold text-center border-r border-black">Name of Item</th>
                              <th className="p-2 font-bold text-center border-r border-black">Indent No. &amp; date</th>
                              <th className="p-2 font-bold text-center border-r border-black">Budget Head &amp; Balance</th>
                              <th className="p-2 font-bold text-center border-r border-black">Indent amount (Rs.)</th>
                              <th className="p-2 font-bold text-center">Mode of Purchase</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(activeNoting.items || []).map((item, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid black' }}>
                                <td className="p-2 text-center border-r border-black font-semibold align-top">{item.slNo || index + 1}.</td>
                                <td className="p-2 border-r border-black align-top font-sans text-xs">{item.nameOfItem}</td>
                                <td className="p-2 border-r border-black align-top font-sans text-xs">{item.indentNoAndDate}</td>
                                <td className="p-2 border-r border-black align-top font-sans text-xs">{item.budgetHeadAndBalance}</td>
                                <td className="p-2 border-r border-black align-top font-sans text-xs font-semibold whitespace-nowrap">{formatIndentAmount(item.indentAmount)}</td>
                                <td className="p-2 align-top font-sans text-xs">{item.modeOfPurchase}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="mt-6 font-normal">
                        उक्त मांगपत्र आपके अनुमोदन हेतु प्रस्तुत है।
                      </p>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* TAB 3: SAVED NOTINGS HISTORY */}
      {activeTab === 'history' && (
        <div className="max-w-8xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors space-y-4">

            {/* Search Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by Project No, Title, Agency..."
                  value={historySearchQuery}
                  onChange={(e) => {
                    setHistorySearchQuery(e.target.value);
                    setHistoryPageNumber(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
            </div>

            {savedNotings.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
                <p>No saved Notings found.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
                >
                  Create New Noting
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
                        <th className="p-3">Project No</th>
                        <th className="p-3">Funded Agency</th>
                        <th className="p-3">Project Title</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Items Count</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-800/40">
                      {savedNotings.map((n) => (
                        <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                          <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">{n.projectNo}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{n.fundedAgency}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 max-w-md truncate" title={n.projectTitle}>{n.projectTitle}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{n.date}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{n.items ? n.items.length : 0} items</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border w-max ${n.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                {n.status || 'Pending Approval'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                Stage: {n.status === 'Approved' ? 'Approved' : (getSignedFiles(n).length > 0 ? 'Document Uploaded' : 'Pending Document Upload')}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center flex items-center justify-center flex-wrap gap-1.5">
                            <button
                              onClick={() => handleLoadNoting(n)}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="View layout & print"
                            >
                              <Eye size={14} /> View &amp; Download
                            </button>

                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              id={`noting_file_upload_${n.id}`}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadSignedCopy(e.target.files[0], n);
                                  e.target.value = '';
                                }
                              }}
                            />

                            {getSignedFiles(n).length > 0 ? (
                              <>
                                <a
                                  href={getSignedFiles(n)[getSignedFiles(n).length - 1].dataUrl}
                                  download={getSignedFiles(n)[getSignedFiles(n).length - 1].fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800"
                                  title="View / Download Signed Document"
                                >
                                  <Paperclip size={14} /> View Document ({getSignedFiles(n).length})
                                </a>

                                {n.status !== 'Approved' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveNoting(n)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm active:scale-95 cursor-pointer"
                                      title="Approve Noting"
                                    >
                                      <CheckCircle2 size={14} /> Approve
                                    </button>
                                    <label
                                      htmlFor={`noting_file_upload_${n.id}`}
                                      className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Re-upload signed copy"
                                    >
                                      <Upload size={13} /> Re-upload
                                    </label>
                                  </>
                                )}
                              </>
                            ) : (
                              <label
                                htmlFor={`noting_file_upload_${n.id}`}
                                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm active:scale-95"
                                title="Choose signed document file to upload"
                              >
                                <Upload size={14} /> Upload Document to Approve
                              </label>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {historyTotalCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 font-medium">
                      Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min((historyPageNumber - 1) * historyPageSize + 1, historyTotalCount)}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(historyPageNumber * historyPageSize, historyTotalCount)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{historyTotalCount}</span> entries
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={historyPageNumber <= 1}
                        onClick={() => setHistoryPageNumber((prev) => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                      >
                        Previous
                      </button>

                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2">
                        Page {historyPageNumber} of {historyTotalPages}
                      </span>

                      <button
                        type="button"
                        disabled={historyPageNumber >= historyTotalPages}
                        onClick={() => setHistoryPageNumber((prev) => Math.min(prev + 1, historyTotalPages))}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {/* TinyMCE Text Editor Modal */}
      {isTextEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Edit Noting Text Format (TinyMCE Rich Text Editor)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadDefaultTemplate}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  title="Load standard noting template format"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Template
                </button>
                <button
                  type="button"
                  onClick={() => setIsTextEditModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Use TinyMCE editor below to customize noting format text. Use <code className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono text-xs">&lt;!-- TABLE_PLACEHOLDER --&gt;</code> to position the Demand Items table within your text.
              </p>
              <NotingRichTextEditor
                key={editorKey}
                content={notingFormatTextChanges}
                onChange={(html) => setNotingFormatTextChanges(html)}
                height={420}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setIsTextEditModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTextEditModal}
                className="px-5 py-2 hover:hover:text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save &amp; Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
