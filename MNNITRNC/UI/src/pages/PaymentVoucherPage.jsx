import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Trash2,
  Printer,
  Send,
  Save,
  RotateCcw,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Search,
  Filter,
  Eye,
  X,
  Upload,
  Download,
  FileCheck,
  Paperclip,
  History
} from 'lucide-react';
import { getPaymentVouchers, createPaymentVoucher, updatePaymentVoucherStatus, getProjectHeadSnapshots, getPaymentVoucherAccountDetails, createPaymentVoucherAccountDetail } from '../api/paymentVoucherApi';
import { getProject } from '../api/projectsApi';
import { getClaim, createVoucherFromClaims } from '../api/fellowshipApi';
import { Wallet, AlertTriangle, Check } from 'lucide-react';
import { formatCurrency } from './projects/utils/currency';
import { useAuth } from '../auth/useAuth';
import toast from 'react-hot-toast';

// Helper function to convert numbers into words (Indian Rupees system)
function numberToWords(num) {
  if (!num || isNaN(num) || num <= 0) return '';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let str = 'Rupees ' + inWords(rupees);
  if (paise > 0) {
    str += ' and ' + inWords(paise) + ' Paise';
  }
  return str + ' Only';
}

// Helper to clean up raw head names to friendly user labels
export function getFriendlyHeadLabel(rawHeadStr) {
  if (!rawHeadStr) return 'Consumable';
  const str = String(rawHeadStr).trim();
  const lower = str.toLowerCase();

  if (lower.includes('travel')) return 'Travel';
  if (lower.includes('consumable')) return 'Consumable';
  if (lower.includes('contingency')) return 'Contingency';
  if (lower.includes('equipment') || lower.includes('nonrecurring') || lower.includes('non-recurring')) return 'Equipment';
  if (lower.includes('manpower')) return 'Manpower';
  if (lower.includes('overhead')) return 'Overhead';
  if (lower.includes('fieldcharge') || lower.includes('field charge') || lower.includes('field')) return 'Field Charges';
  if (lower.includes('parts')) return 'Parts';
  if (lower.includes('ssr')) return 'SSR';
  return str;
}

// Helper to find matching snapshot by raw head name, display name, custom label, or friendly label
export function findMatchingHeadSnapshot(snapshots, targetStr) {
  if (!snapshots || snapshots.length === 0 || !targetStr) return null;
  const targetLower = String(targetStr).toLowerCase().trim();

  // 1. Match by budgetHeadId directly
  let match = snapshots.find(s => s.budgetHeadId === targetStr);
  if (match) return match;

  // 2. Match exact displayName, headName, or customLabel
  match = snapshots.find(s =>
    s.displayName?.toLowerCase() === targetLower ||
    s.headName?.toLowerCase() === targetLower ||
    (s.customLabel && s.customLabel.toLowerCase() === targetLower)
  );
  if (match) return match;

  // 3. Match friendly label & bidirectional substring
  const friendlyTarget = getFriendlyHeadLabel(targetStr).toLowerCase();
  match = snapshots.find(s => {
    const dLower = String(s.displayName || '').toLowerCase();
    const hLower = String(s.headName || '').toLowerCase();
    const cLower = String(s.customLabel || '').toLowerCase();
    const sFriendly = getFriendlyHeadLabel(s.displayName || s.headName || s.customLabel).toLowerCase();

    return sFriendly === friendlyTarget ||
      hLower.includes(friendlyTarget) ||
      dLower.includes(friendlyTarget) ||
      cLower.includes(friendlyTarget) ||
      friendlyTarget.includes(sFriendly) ||
      friendlyTarget.includes(hLower) ||
      friendlyTarget.includes(dLower);
  });

  return match || null;
}

const DEFAULT_BANK_AC = '';

const INITIAL_ITEM = {
  id: 1,
  letterNoDateMbNo: '',
  supplierInvoiceGoods: '',
  headCategory: 'Consumable',
  currentHeadBalance: 0,
  billAmount: 0, // Taxable Value (Rs.)
  gstAmount: 0,  // GST Amount (Rs.)
  grossValue: 0, // Gross Value (Rs.)
  tdsGst: 0,     // TDS GST (Rs.)
  tdsIt: 0,      // IT TDS (Rs.)
  ldAmount: 0,   // LD Deduction (Rs.)
  balanceAfterPayment: 0,
  isGrossManual: false
};



export default function PaymentVoucherPage() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract parameters from query string or location state (passed from ProcessBillFormPage)
  const paramProjectId = searchParams.get('projectId') || location.state?.projectId || '';
  const paramIndentId = searchParams.get('indentId') || location.state?.indentId || '';
  const paramIndentType = searchParams.get('indentType') || location.state?.indentType || '';
  const paramModeOfPurchase = searchParams.get('modeOfPurchase') || location.state?.modeOfPurchase || 'Non-GeM';
  const paramProjectTitle = searchParams.get('projectTitle') || location.state?.projectTitle || '';
  const paramProjectNo = searchParams.get('projectNo') || location.state?.projectNo || '';
  const paramSanctionDate = searchParams.get('sanctionDate') || location.state?.sanctionDate || '';
  const paramFundedAgency = searchParams.get('fundedAgency') || location.state?.fundedAgency || '';
  const paramBillNo = searchParams.get('billNo') || location.state?.billNo || '';
  const paramBillAmount = searchParams.get('billAmount') || location.state?.billAmount || '';
  const paramItemDescription = searchParams.get('itemDescription') || location.state?.itemDescription || '';
  // Set when arriving from the DA's "Ready to Voucher" fellowship-claim
  // selection (FellowshipVoucherSelectionPage) instead of from a single
  // project/indent -- routes submission to createVoucherFromClaims instead
  // of the single-project createPaymentVoucher.
  const fellowshipClaimIds = location.state?.fellowshipClaimIds ?? null;
  const isFellowshipVoucherMode = Array.isArray(fellowshipClaimIds) && fellowshipClaimIds.length > 0;

  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Preview / Print Modal State
  const [previewVoucher, setPreviewVoucher] = useState(null);

  // Signed Document Chain Modal State
  const [signedDocModalVoucher, setSignedDocModalVoucher] = useState(null);
  const [uploadingSignedFile, setUploadingSignedFile] = useState(false);
  const [fileUploadSuccess, setFileUploadSuccess] = useState('');

  const getSignedFiles = useCallback((voucher) => {
    if (!voucher) return [];
    if (Array.isArray(voucher.signedFiles)) return voucher.signedFiles;
    if (voucher.signedFilesJson) {
      try {
        return JSON.parse(voucher.signedFilesJson);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  const handleUploadSignedCopy = async (file, voucherTarget = null) => {
    const targetVoucher = voucherTarget || signedDocModalVoucher;
    if (!targetVoucher || !file) return;

    try {
      setUploadingSignedFile(true);
      setFileUploadSuccess('');

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const currentList = getSignedFiles(targetVoucher);
        const newRecord = {
          id: `sf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF',
          uploadedByRole: userRoles[0] || 'Office Assistant',
          uploadedByName: user?.fullName || user?.username || 'Officer',
          stage: 'Uploaded Document',
          uploadedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          dataUrl: dataUrl
        };

        const updatedList = [...currentList, newRecord];
        const jsonStr = JSON.stringify(updatedList);

        await updatePaymentVoucherStatus(targetVoucher.id, targetVoucher.status, targetVoucher.currentStage, jsonStr);
        await loadVouchers();

        const updatedVoucher = { ...targetVoucher, signedFilesJson: jsonStr, signedFiles: updatedList };
        setSignedDocModalVoucher(updatedVoucher);
        setFileUploadSuccess('Signed voucher document uploaded successfully!');
        setUploadingSignedFile(false);
        setTimeout(() => setFileUploadSuccess(''), 4000);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload signed document file');
      setUploadingSignedFile(false);
    }
  };

  // Form State
  const [voucherType, setVoucherType] = useState('upto100k'); // 'upto100k' | 'above100k'
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankAccountNo, setBankAccountNo] = useState(DEFAULT_BANK_AC);
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRs, setPayRs] = useState('');
  const [grossValue, setGrossValue] = useState('');
  const [isHeaderGrossManual, setIsHeaderGrossManual] = useState(false);
  const [taxableAmount, setTaxableAmount] = useState('');
  const [payableAmount, setPayableAmount] = useState('');

  // Optional Tax & Deduction Toggles & Customizable Rates
  const [showGst, setShowGst] = useState(false);
  const [gstRate, setGstRate] = useState(18);
  const [showTdsGst, setShowTdsGst] = useState(false);
  const [tdsGstRate, setTdsGstRate] = useState(2);
  const [showTdsIt, setShowTdsIt] = useState(false);
  const [tdsItRate, setTdsItRate] = useState(2);
  const [showLd, setShowLd] = useState(false);
  const [ldRate, setLdRate] = useState(0.5);

  // Project & Party Info
  const [coordinatorNameDept, setCoordinatorNameDept] = useState('');
  const [projectSanctionNo, setProjectSanctionNo] = useState('');
  const [fundingAgency, setFundingAgency] = useState('');
  const [paymentTo, setPaymentTo] = useState('');

  // Payee Bank Details State (Database backed)
  const [savedPayees, setSavedPayees] = useState([]);
  const [loadingPayees, setLoadingPayees] = useState(false);
  const [savingPayee, setSavingPayee] = useState(false);
  const [payeeSearch, setPayeeSearch] = useState('');
  const [selectedPayeeId, setSelectedPayeeId] = useState('');
  const [payeeAccountName, setPayeeAccountName] = useState('');
  const [payeeAccountNo, setPayeeAccountNo] = useState('');
  const [payeeIfscCode, setPayeeIfscCode] = useState('');
  const [payeeBankName, setPayeeBankName] = useState('');

  // Fetch saved payee account details from backend database
  const fetchSavedPayees = useCallback(async () => {
    try {
      setLoadingPayees(true);
      const data = await getPaymentVoucherAccountDetails();
      if (Array.isArray(data)) {
        setSavedPayees(data);
      }
    } catch (err) {
      console.error("Failed to load saved payee account details:", err);
    } finally {
      setLoadingPayees(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPayees();
  }, [fetchSavedPayees]);

  // Filter saved payees by search query for searchable dropdown
  const filteredSavedPayees = useMemo(() => {
    if (!payeeSearch.trim()) return savedPayees;
    const q = payeeSearch.toLowerCase();
    return savedPayees.filter(p =>
      (p.payeeName || p.name || '').toLowerCase().includes(q) ||
      (p.accountName || '').toLowerCase().includes(q) ||
      (p.accountNo || '').toLowerCase().includes(q) ||
      (p.bankName || '').toLowerCase().includes(q)
    );
  }, [savedPayees, payeeSearch]);

  const handlePayeeSelect = (payeeId) => {
    setSelectedPayeeId(payeeId);
    if (!payeeId || payeeId === 'custom') {
      if (payeeId === 'custom') {
        setPaymentTo('');
        setPayeeAccountName('');
        setPayeeAccountNo('');
        setPayeeIfscCode('');
        setPayeeBankName('');
      }
      return;
    }
    const found = savedPayees.find((p) => p.id === payeeId || String(p.id) === String(payeeId));
    if (found) {
      setPaymentTo(found.payeeName || found.name || '');
      setPayeeAccountName(found.accountName || '');
      setPayeeAccountNo(found.accountNo || '');
      setPayeeIfscCode(found.ifscCode || '');
      setPayeeBankName(found.bankName || '');
    }
  };

  // Save custom entered payee details into PaymentVoucherAccountDetails database table
  const handleSavePayeeAccountDetails = async () => {
    if (!paymentTo && !payeeAccountName) {
      toast.error('Please enter a Payee Name / Firm Name before saving.');
      return;
    }
    try {
      setSavingPayee(true);
      const payload = {
        payeeName: paymentTo || payeeAccountName,
        accountName: payeeAccountName || paymentTo,
        accountNo: payeeAccountNo || '',
        ifscCode: payeeIfscCode || '',
        bankName: payeeBankName || '',
        createdBy: user?.name || user?.username || user?.email || 'User'
      };
      await createPaymentVoucherAccountDetail(payload);
      toast.success('Payee account details saved successfully!');

      // Clear fields after save as requested ("after save field are clear and ashow in the drop down")
      setPaymentTo('');
      setPayeeAccountName('');
      setPayeeAccountNo('');
      setPayeeIfscCode('');
      setPayeeBankName('');
      setSelectedPayeeId('');
      setPayeeSearch('');

      // Refresh saved payees dropdown list from backend database
      await fetchSavedPayees();
    } catch (err) {
      console.error("Failed to save payee account details:", err);
      toast.error("Failed to save payee account details. Please try again.");
    } finally {
      setSavingPayee(false);
    }
  };

  // Dynamic Item List
  const [items, setItems] = useState([INITIAL_ITEM]);
  const [headSnapshots, setHeadSnapshots] = useState([]);
  const [loadedProject, setLoadedProject] = useState(null);

  // Custom manual override for words
  const [manualWords, setManualWords] = useState('');

  // Fetch Existing Vouchers with backend pagination and searching
  const loadVouchers = useCallback(async (customParams = {}) => {
    try {
      setLoading(true);
      const params = {
        pageNumber: customParams.pageNumber ?? pageNumber,
        pageSize: customParams.pageSize ?? pageSize,
        search: customParams.search !== undefined ? customParams.search : searchQuery,
        status: customParams.status !== undefined ? customParams.status : statusFilter,
      };
      const res = await getPaymentVouchers(params);
      if (res && res.items !== undefined) {
        setVouchers(res.items || []);
        setTotalCount(res.totalCount || 0);
        setTotalPages(res.totalPages || 1);
      } else if (Array.isArray(res)) {
        setVouchers(res);
        setTotalCount(res.length);
        setTotalPages(Math.ceil(res.length / (customParams.pageSize || pageSize)) || 1);
      } else {
        setVouchers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error loading payment vouchers:", err);
    } finally {
      setLoading(false);
    }
  }, [pageNumber, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadVouchers({ pageNumber, pageSize, search: searchQuery, status: statusFilter });
    }, 300);
    return () => clearTimeout(timer);
  }, [pageNumber, pageSize, searchQuery, statusFilter, loadVouchers]);

  // Initialize form with data passed from ProcessBillFormPage / TravelBillFormPage
  useEffect(() => {
    let active = true;

    if (paramProjectId) {
      Promise.all([
        getProject(paramProjectId).catch(() => null),
        getProjectHeadSnapshots(paramProjectId).catch(() => [])
      ]).then(([projData, snapshotsData]) => {
        if (!active) return;

        if (snapshotsData && snapshotsData.length > 0) {
          setHeadSnapshots(snapshotsData);
        }

        if (projData) {
          setLoadedProject(projData);
          const piName = projData.piName || projData.piUsername || '';
          const title = projData.projectTitle || paramProjectTitle || 'Research Project';
          const sanctionNo = projData.sanctionNo || paramProjectNo || '';
          const agency = projData.agency || paramFundedAgency || '';

          const coordDisplay = piName
            ? `${piName} (${title} - Sanction: ${sanctionNo}) | Mode: ${paramModeOfPurchase}`
            : `${title} (Sanction: ${sanctionNo}) | Mode: ${paramModeOfPurchase}`;

          setCoordinatorNameDept(coordDisplay.trim());
          setProjectSanctionNo(sanctionNo);
          setFundingAgency(agency);

          // Auto select payee if PI reimbursement or match
          if (piName && !paymentTo && savedPayees.length > 0) {
            const foundPiPayee = savedPayees.find(p => (p.payeeName || p.name || '').toLowerCase().includes(piName.toLowerCase()) || (p.accountName || '').toLowerCase().includes(piName.toLowerCase()));
            if (foundPiPayee) {
              setSelectedPayeeId(foundPiPayee.id);
              setPaymentTo(foundPiPayee.payeeName || foundPiPayee.name || '');
              setPayeeAccountName(foundPiPayee.accountName || '');
              setPayeeAccountNo(foundPiPayee.accountNo || '');
              setPayeeIfscCode(foundPiPayee.ifscCode || '');
              setPayeeBankName(foundPiPayee.bankName || '');
            }
          }
        } else {
          const projectInfo = `Project ID: ${paramProjectId}`;
          const projectDisplay = paramProjectTitle ? `${paramProjectTitle}` : projectInfo;
          const sanctionInfo = paramProjectNo ? `(Sanction: ${paramProjectNo})` : '';
          setCoordinatorNameDept(`${projectDisplay} ${sanctionInfo} | Mode: ${paramModeOfPurchase}`.trim());
          setProjectSanctionNo(paramProjectNo || '');
          setFundingAgency(paramFundedAgency || '');
        }

        // Determine target head category
        const rawTargetHead = paramIndentType || 'Consumable';
        const matchingSnap = findMatchingHeadSnapshot(snapshotsData, rawTargetHead);

        const headCategoryName = matchingSnap ? (matchingSnap.displayName || matchingSnap.headName) : rawTargetHead;
        const curBal = matchingSnap ? (matchingSnap.available !== undefined ? matchingSnap.available : 0) : 0;
        const bHeadId = matchingSnap ? matchingSnap.budgetHeadId : null;
        const initialBillAmt = paramBillAmount ? parseFloat(paramBillAmount) : 0;

        setItems([
          {
            id: 1,
            letterNoDateMbNo: paramBillNo ? `Bill Ref: ${paramBillNo}` : '',
            supplierInvoiceGoods: paramItemDescription || (rawTargetHead.toLowerCase().includes('travel') ? `Travel Reimbursement Bill (${paramBillNo || 'Approved'})` : 'Procurement Item'),
            headCategory: headCategoryName,
            budgetHeadId: bHeadId,
            currentHeadBalance: curBal,
            billAmount: initialBillAmt,
            gstAmount: 0,
            grossValue: initialBillAmt > 0 ? initialBillAmt : 0,
            tdsGst: 0,
            tdsIt: 0,
            ldAmount: 0,
            balanceAfterPayment: Math.max(0, curBal - initialBillAmt),
            isGrossManual: false
          }
        ]);
      });
    } else if (paramBillNo || paramBillAmount) {
      setItems([
        {
          id: 1,
          letterNoDateMbNo: paramBillNo ? `Bill Ref: ${paramBillNo}` : '',
          supplierInvoiceGoods: paramItemDescription || 'Procurement Item',
          headCategory: paramIndentType || 'Consumable',
          budgetHeadId: null,
          currentHeadBalance: 0,
          billAmount: paramBillAmount ? parseFloat(paramBillAmount) : 0,
          gstAmount: 0,
          grossValue: paramBillAmount ? parseFloat(paramBillAmount) : 0,
          tdsGst: 0,
          tdsIt: 0,
          ldAmount: 0,
          balanceAfterPayment: 0,
          isGrossManual: false
        }
      ]);
    }

    return () => { active = false; };
  }, [paramProjectId, paramIndentId, paramIndentType, paramModeOfPurchase, paramProjectTitle, paramProjectNo, paramSanctionDate, paramFundedAgency, paramBillNo, paramBillAmount, paramItemDescription]);

  // Populate the form from a batch of Dean-approved fellowship claims
  // selected on FellowshipVoucherSelectionPage, fetching each claim's project
  // budget head snapshots so Manpower budget balance is loaded and displayed.
  useEffect(() => {
    if (!isFellowshipVoucherMode) return;
    let active = true;

    Promise.all(fellowshipClaimIds.map((id) => getClaim(id))).then(async (claims) => {
      if (!active) return;

      const projectIds = Array.from(new Set(claims.map((c) => c.projectId).filter(Boolean)));
      let allSnapshots = [];
      const projectDataMap = {};

      if (projectIds.length > 0) {
        try {
          const snapshotResults = await Promise.all(
            projectIds.map((pId) => getProjectHeadSnapshots(pId).catch(() => []))
          );
          const projectResults = await Promise.all(
            projectIds.map((pId) => getProject(pId).catch(() => null))
          );

          projectIds.forEach((pId, index) => {
            if (projectResults[index]) {
              projectDataMap[pId] = projectResults[index];
            }
          });

          allSnapshots = snapshotResults.flat();
          if (allSnapshots.length > 0) {
            setHeadSnapshots(allSnapshots);
          }
        } catch (e) {
          console.error('Error fetching project head snapshots for fellowship claims:', e);
        }
      }

      setItems(claims.map((c, idx) => {
        const payableAmount = c.recommendedAmount ?? c.totalAmount;
        const matchingSnap = findMatchingHeadSnapshot(allSnapshots, 'RecurringManpower') ||
                             findMatchingHeadSnapshot(allSnapshots, 'Manpower');

        const headCategoryName = matchingSnap ? (matchingSnap.displayName || matchingSnap.headName) : 'RecurringManpower';
        const curBal = matchingSnap ? (matchingSnap.available !== undefined ? matchingSnap.available : 0) : 0;
        const bHeadId = matchingSnap ? matchingSnap.budgetHeadId : null;

        return {
          id: idx + 1,
          letterNoDateMbNo: (c.rollNo && c.rollNo !== 'N/A') ? c.rollNo : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : ''),
          supplierInvoiceGoods: `Fellowship claim ${c.claimMonth}/${c.claimYear} - ${c.scholarName}`,
          headCategory: headCategoryName,
          budgetHeadId: bHeadId,
          currentHeadBalance: curBal,
          billAmount: payableAmount,
          gstAmount: 0,
          grossValue: payableAmount,
          tdsGst: 0,
          tdsIt: 0,
          ldAmount: 0,
          balanceAfterPayment: Math.max(0, curBal - payableAmount),
          isGrossManual: false,
          fellowshipClaimId: c.id,
        };
      }));

      const firstProj = projectDataMap[claims[0]?.projectId];
      const piName = firstProj?.piName || firstProj?.piUsername || claims[0]?.piName || '';
      const title = firstProj?.projectTitle || claims[0]?.projectTitle || '';
      const sanctionNo = firstProj?.sanctionNo || '';
      const agency = firstProj?.agency || '';

      const coordDisplay = piName
        ? `${piName} (${title}${sanctionNo ? ` - Sanction: ${sanctionNo}` : ''})`
        : title;

      setCoordinatorNameDept(coordDisplay);
      if (sanctionNo) setProjectSanctionNo(sanctionNo);
      if (agency) setFundingAgency(agency);
      setPaymentTo(claims.map((c) => c.scholarName).join(', '));
    }).catch((err) => {
      if (!active) return;
      toast.error(err?.message || 'Failed to load the selected fellowship claims.');
    });

    return () => { active = false; };
  }, [isFellowshipVoucherMode, fellowshipClaimIds]);

  // Update item tax/deduction amounts and balance after payment whenever toggles or percentage rates change
  useEffect(() => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        const taxable = parseFloat(item.billAmount) || 0;
        const curBal = parseFloat(item.currentHeadBalance) || 0;

        // LD calculation (default 0.5% of Taxable if showLd is checked)
        const lRate = showLd ? (parseFloat(ldRate) || 0) : 0;
        const ldVal = showLd ? (lRate > 0 ? Math.round(taxable * (lRate / 100) * 100) / 100 : (parseFloat(item.ldAmount) || 0)) : 0;

        // Gross Value (default Taxable * 1.18 unless manually edited)
        let grossVal = item.grossValue;
        if (!item.isGrossManual) {
          grossVal = taxable > 0 ? Math.round(taxable * 1.18 * 100) / 100 : (item.grossValue || '');
        }

        // TDS and IT TDS calculated directly on Taxable Value
        const gTdsRate = showTdsGst ? (parseFloat(tdsGstRate) || 0) : 0;
        const iTdsRate = showTdsIt ? (parseFloat(tdsItRate) || 0) : 0;

        const tdsGstVal = showTdsGst ? Math.round(taxable * (gTdsRate / 100) * 100) / 100 : 0;
        const tdsItVal = showTdsIt ? Math.round(taxable * (iTdsRate / 100) * 100) / 100 : 0;

        const effectiveGross = parseFloat(grossVal) || 0;
        const effectiveLd = showLd ? (parseFloat(ldVal) || 0) : 0;

        return {
          ...item,
          ldAmount: ldVal,
          gstAmount: 0,
          grossValue: grossVal,
          tdsGst: tdsGstVal,
          tdsIt: tdsItVal,
          balanceAfterPayment: Math.max(0, curBal - effectiveGross + effectiveLd),
        };
      })
    );
  }, [showGst, gstRate, showTdsGst, tdsGstRate, showTdsIt, tdsItRate, showLd, ldRate]);

  // Handle Item Field Changes
  const handleItemChange = (index, field, value) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const item = { ...updated[index], [field]: value };

      if (field === 'headCategory' && headSnapshots.length > 0) {
        const match = findMatchingHeadSnapshot(headSnapshots, value);
        if (match) {
          item.budgetHeadId = match.budgetHeadId;
          item.currentHeadBalance = match.available !== undefined ? match.available : 0;
          item.headCategory = match.displayName || match.headName || value;
        }
      }

      const taxable = parseFloat(item.billAmount) || 0;
      const curBal = parseFloat(item.currentHeadBalance) || 0;

      const lRate = showLd ? (parseFloat(ldRate) || 0) : 0;
      let ldVal = showLd ? Math.round(taxable * (lRate / 100) * 100) / 100 : 0;
      if (showLd && field === 'ldAmount') {
        ldVal = parseFloat(value) || 0;
      }

      let grossVal;
      if (field === 'grossValue') {
        item.isGrossManual = true;
        grossVal = value;
      } else if (field === 'billAmount') {
        if (!item.isGrossManual) {
          grossVal = taxable > 0 ? Math.round(taxable * 1.18 * 100) / 100 : '';
        } else {
          grossVal = item.grossValue;
        }
      } else {
        if (!item.isGrossManual) {
          grossVal = (taxable > 0 && (!item.grossValue || parseFloat(item.grossValue) === 0))
            ? Math.round(taxable * 1.18 * 100) / 100
            : item.grossValue;
        } else {
          grossVal = item.grossValue;
        }
      }

      const gTdsRate = showTdsGst ? (parseFloat(tdsGstRate) || 0) : 0;
      const iTdsRate = showTdsIt ? (parseFloat(tdsItRate) || 0) : 0;

      // TDS calculated directly on Taxable Value
      let tdsGstVal = showTdsGst ? Math.round(taxable * (gTdsRate / 100) * 100) / 100 : 0;
      if (showTdsGst && field === 'tdsGst') {
        tdsGstVal = parseFloat(value) || 0;
      }

      let tdsItVal = showTdsIt ? Math.round(taxable * (iTdsRate / 100) * 100) / 100 : 0;
      if (showTdsIt && field === 'tdsIt') {
        tdsItVal = parseFloat(value) || 0;
      }

      const effectiveGross = parseFloat(grossVal) || 0;
      const effectiveLd = showLd ? (parseFloat(ldVal) || 0) : 0;

      item.ldAmount = ldVal;
      item.gstAmount = 0;
      item.grossValue = grossVal;
      item.tdsGst = tdsGstVal;
      item.tdsIt = tdsItVal;
      item.balanceAfterPayment = Math.max(0, curBal - effectiveGross + effectiveLd);

      updated[index] = item;
      return updated;
    });
  };

  // Add Item Row
  const addItemRow = () => {
    setItems((prev) => {
      return [
        ...prev,
        {
          id: prev.length + 1,
          letterNoDateMbNo: '',
          supplierInvoiceGoods: '',
          headCategory: 'Consumable',
          currentHeadBalance: 100000,
          billAmount: 0,
          gstAmount: 0,
          grossValue: 0,
          tdsGst: 0,
          tdsIt: 0,
          ldAmount: 0,
          balanceAfterPayment: 100000,
          isGrossManual: false
        }
      ];
    });
  };

  // Remove Item Row
  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Aggregated Summary Calculations
  const totalTaxableAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.billAmount) || 0), 0);
  }, [items]);

  const totalGstAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.gstAmount) || 0), 0);
  }, [items]);

  const totalGrossAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const gross = parseFloat(item.grossValue);
      if (!isNaN(gross) && gross > 0) return sum + gross;
      const bill = parseFloat(item.billAmount) || 0;
      return sum + (bill > 0 ? Math.round(bill * 1.18 * 100) / 100 : 0);
    }, 0);
  }, [items]);

  const totalTdsGst = useMemo(() => {
    if (!showTdsGst) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.tdsGst) || 0), 0);
  }, [items, showTdsGst]);

  const totalTdsIt = useMemo(() => {
    if (!showTdsIt) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.tdsIt) || 0), 0);
  }, [items, showTdsIt]);

  const totalLdAmount = useMemo(() => {
    if (!showLd) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.ldAmount) || 0), 0);
  }, [items, showLd]);

  const totalBobTdsTransfer = totalTdsGst + totalTdsIt;
  const netPayableToFirm = Math.max(0, totalGrossAmount - totalBobTdsTransfer - totalLdAmount);

  // Auto generated words
  const generatedWords = useMemo(() => {
    return numberToWords(totalGrossAmount || totalTaxableAmount);
  }, [totalGrossAmount, totalTaxableAmount]);

  // Synchronize Voucher Type based on amount
  useEffect(() => {
    const effectiveTotal = totalGrossAmount || totalTaxableAmount;
    if (effectiveTotal > 100000) {
      setVoucherType('above100k');
    } else {
      setVoucherType('upto100k');
    }
  }, [totalGrossAmount, totalTaxableAmount]);

  // Sync Pay, Gross, Taxable, and Net Payable inputs with table calculations
  useEffect(() => {
    const effectiveTotal = totalGrossAmount || totalTaxableAmount;
    if (effectiveTotal > 0) {
      if (!isHeaderGrossManual) {
        setGrossValue(totalGrossAmount);
      }
      setTaxableAmount(totalTaxableAmount);
      setPayableAmount(netPayableToFirm > 0 ? netPayableToFirm : effectiveTotal);
      setPayRs(netPayableToFirm > 0 ? netPayableToFirm : effectiveTotal);
    }
  }, [totalGrossAmount, totalTaxableAmount, netPayableToFirm, isHeaderGrossManual]);



  // Reset Form
  const handleResetForm = () => {
    setIsHeaderGrossManual(false);
    setVoucherType('upto100k');
    setVoucherNo('');
    setVoucherDate(new Date().toISOString().split('T')[0]);
    setBankAccountNo(DEFAULT_BANK_AC);
    setChequeNo('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setPayRs('');
    setGrossValue('');
    setTaxableAmount('');
    setPayableAmount('');
    setShowGst(false);
    setGstRate(18);
    setShowTdsGst(false);
    setTdsGstRate(2);
    setShowTdsIt(false);
    setTdsItRate(2);
    setShowLd(false);
    setLdRate(0.5);
    setCoordinatorNameDept('');
    setProjectSanctionNo('');
    setFundingAgency('');
    setSelectedPayeeId('');
    setPaymentTo('');
    setPayeeAccountName('');
    setPayeeAccountNo('');
    setPayeeIfscCode('');
    setPayeeBankName('');
    setPayeeSearch('');
    setItems([INITIAL_ITEM]);
    setManualWords('');
  };

  // Submit Voucher Form
  // Submit Voucher Form
  const handleSubmit = async (e, saveAsDraft = false) => {
    if (e) e.preventDefault();

    const effectiveTotal = totalGrossAmount || totalTaxableAmount;
    if (!coordinatorNameDept || !projectSanctionNo || !paymentTo || effectiveTotal <= 0) {
      toast.error('Please fill out all required fields: Coordinator, Project/Sanction No., Payee Name, and valid Line Item Amounts.');
      return;
    }

    if (isFellowshipVoucherMode) {
      // A fellowship-sourced voucher can span several projects, so the
      // single-project headSnapshots balance check below does not apply --
      // CreateVoucherFromClaimsAsync validates each claim's own project's
      // RecurringManpower balance server-side instead (Task 5).
      try {
        setSubmitting(true);
        await createVoucherFromClaims(fellowshipClaimIds, {
          coordinatorNameDept,
          projectSanctionNo,
          paymentTo,
          fundingAgency,
        });
        setSuccessMessage('Payment Voucher created and submitted successfully!');
        navigate('/fellowship-claims');
      } catch (err) {
        toast.error(err?.message || 'Failed to submit Payment Voucher');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Grant money & Available Balance Validation
    if (headSnapshots && headSnapshots.length > 0) {
      const totalGrant = headSnapshots.reduce((sum, s) => sum + (parseFloat(s.grantReceived) || 0), 0);
      const totalSanctioned = headSnapshots.reduce((sum, s) => sum + (parseFloat(s.sanctioned) || 0), 0);
      const totalProjectGrant = headSnapshots[0]?.totalProjectGrantReceived !== undefined
        ? parseFloat(headSnapshots[0].totalProjectGrantReceived) || 0
        : totalGrant;

      if (totalProjectGrant <= 0 && totalGrant <= 0 && totalSanctioned <= 0) {
        alert('Payment cannot be processed: No budget sanctioned or grant money received for this project.');
        return;
      }

      for (const item of items) {
        const matchingSnap = findMatchingHeadSnapshot(headSnapshots, item.headCategory);
        const itemAmount = parseFloat(item.grossValue) || parseFloat(item.billAmount) || 0;
        const availBal = matchingSnap ? (parseFloat(matchingSnap.available) !== undefined ? parseFloat(matchingSnap.available) : (parseFloat(matchingSnap.sanctioned) || 0)) : (parseFloat(item.currentHeadBalance) || 0);

        if (availBal <= 0) {
          alert(`Payment cannot be processed for "${item.headCategory}": Available balance is ₹0.`);
          return;
        }

        if (itemAmount > availBal && availBal > 0) {
          const formattedBill = itemAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
          const formattedBal = availBal.toLocaleString('en-IN', { maximumFractionDigits: 2 });
          alert(`Your bill is ₹${formattedBill}, but the available balance is ₹${formattedBal}. It cannot be processed. Please grant more balance.`);
          return;
        }
      }
    } else {
      for (const item of items) {
        const itemAmount = parseFloat(item.grossValue) || parseFloat(item.billAmount) || 0;
        const headBal = parseFloat(item.currentHeadBalance) || 0;
        if (headBal <= 0) {
          alert(`Payment cannot be processed for "${item.headCategory}": Available balance is ₹0.`);
          return;
        }
        if (itemAmount > headBal && headBal > 0) {
          const formattedBill = itemAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
          const formattedBal = headBal.toLocaleString('en-IN', { maximumFractionDigits: 2 });
          alert(`Your bill is ₹${formattedBill}, but the available balance is ₹${formattedBal}. It cannot be processed. Please grant more balance.`);
          return;
        }
      }
    }

    const payload = {
      projectId: paramProjectId || null,
      indentId: paramIndentId || null,
      voucherNo,
      voucherType,
      date: voucherDate,
      grossValue: parseFloat(grossValue) || totalGrossAmount,
      taxableAmount: parseFloat(taxableAmount) || totalTaxableAmount,
      payableAmount: parseFloat(payableAmount) || netPayableToFirm,
      amount: parseFloat(payableAmount) || netPayableToFirm,
      showGst,
      gstRate: parseFloat(gstRate) || 0,
      totalGstAmount,
      showTdsGst,
      tdsGstRate: parseFloat(tdsGstRate) || 0,
      showTdsIt,
      tdsItRate: parseFloat(tdsItRate) || 0,
      showLd,
      totalLdAmount,
      bankAccountNo,
      chequeNo,
      chequeDate,
      payRs: parseFloat(payRs) || netPayableToFirm,
      coordinatorNameDept,
      projectSanctionNo,
      fundingAgency,
      paymentTo,
      payeeAccountName,
      payeeAccountNo,
      payeeIfscCode,
      payeeBankName,
      items: items.map((item) => ({
        ...item,
        budgetHeadId: item.budgetHeadId || null,
        billAmount: parseFloat(item.billAmount) || 0,
        grossValue: parseFloat(item.grossValue) || 0,
        currentHeadBalance: parseFloat(item.currentHeadBalance) || 0,
        tdsGst: parseFloat(item.tdsGst) || 0,
        tdsIt: parseFloat(item.tdsIt) || 0,
        balanceAfterPayment: parseFloat(item.balanceAfterPayment) || 0
      })),
      firmPaymentAmount: netPayableToFirm,
      bobTransferAmount: totalBobTdsTransfer,
      totalLdDeduction: totalLdAmount,
      totalAmount: effectiveTotal,
      amountInWords: manualWords.trim() || generatedWords,
      status: saveAsDraft ? 'Draft' : 'Pending Approval'
    };

    try {
      setSubmitting(true);
      const created = await createPaymentVoucher(payload);
      setSuccessMessage(saveAsDraft ? 'Draft payment voucher saved!' : 'Payment Voucher created and submitted successfully!');
      await loadVouchers();

      // Reset form after successful voucher creation
      handleResetForm();

      // Auto open print preview for submitted voucher
      setPreviewVoucher(created);

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      toast.error(err?.message || 'Failed to submit Payment Voucher');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Vouchers for History View
  const filteredVouchers = vouchers;

  // Handle Direct Voucher Approval
  const handleApproveVoucher = async (v) => {
    if (!v) return;

    const signedFiles = getSignedFiles(v);
    if (signedFiles.length === 0) {
      setSignedDocModalVoucher(v);
      setFileUploadSuccess(`⚠️ Cannot approve yet: Please upload the signed voucher document first.`);
      return;
    }

    try {
      await updatePaymentVoucherStatus(v.id, 'Approved', 'Approved');
      await loadVouchers();
      if (signedDocModalVoucher && signedDocModalVoucher.id === v.id) {
        setSignedDocModalVoucher(null);
      }
    } catch (err) {
      toast.error('Failed to approve payment voucher');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-8xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
            <Receipt size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Project Payment Voucher
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Office of the Dean (Research & Consultancy) • Motilal Nehru National Institute of Technology Allahabad
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'create'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Plus size={16} /> Create Payment Voucher
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <FileText size={16} /> History & Status ({totalCount})
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-sm">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {activeTab === 'create' ? (
        /* CREATE PAYMENT VOUCHER FORM */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-colors overflow-hidden">

          {/* Action toolbar inside form header */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Form Mode:</span>
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-md border border-blue-200 dark:border-blue-800">
                Official R&C Voucher Standard Form
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Reset Form
              </button>
            </div>
          </div>

          <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 md:p-8 space-y-8">

            {/* Header Document Metadata Section */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50/50 dark:bg-slate-800/20 space-y-6">

              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-widest mb-1">
                  <Building2 size={16} /> Motilal Nehru National Institute of Technology Allahabad
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Office of the Dean (Research & Consultancy)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Prayagraj - 211004 (U.P.), India
                </p>
              </div>

              {/* Voucher Category Radio Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                <label className={`flex items-center gap-3 px-5 py-3 rounded-xl border cursor-pointer transition-all ${voucherType === 'upto100k'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}>
                  <input
                    type="radio"
                    name="voucherType"
                    value="upto100k"
                    checked={voucherType === 'upto100k'}
                    onChange={() => setVoucherType('upto100k')}
                    className="w-4 h-4 text-blue-600 accent-blue-600"
                  />
                  <span>Project Payment Voucher (Up to ₹ 1,00,000/-)</span>
                </label>

                <label className={`flex items-center gap-3 px-5 py-3 rounded-xl border cursor-pointer transition-all ${voucherType === 'above100k'
                  ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}>
                  <input
                    type="radio"
                    name="voucherType"
                    value="above100k"
                    checked={voucherType === 'above100k'}
                    onChange={() => setVoucherType('above100k')}
                    className="w-4 h-4 text-purple-600 accent-purple-600"
                  />
                  <span>Project Payment Voucher (More than ₹ 1,00,000/-)</span>
                </label>
              </div>

              {/* Header Fields Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Voucher No.
                  </label>
                  <input
                    type="text"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    placeholder="e.g. PV/2026/08/001"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Gross Value (Rs.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      value={grossValue}
                      onChange={(e) => {
                        setIsHeaderGrossManual(true);
                        setGrossValue(e.target.value);
                      }}
                      placeholder="Gross Amount"
                      className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Taxable Values (Rs.) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      value={taxableAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaxableAmount(val);
                        const taxVal = parseFloat(val) || 0;
                        if (!isHeaderGrossManual) {
                          if (taxVal > 0) {
                            setGrossValue(Math.round(taxVal * 1.18 * 100) / 100);
                          } else {
                            setGrossValue('');
                          }
                        }
                      }}
                      placeholder="Taxable Amount"
                      className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Net Payment / Pay to Party <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      value={payableAmount}
                      onChange={(e) => setPayableAmount(e.target.value)}
                      placeholder="Net Payable Amount"
                      className="w-full pl-7 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>


              {/* Header Fields Row 2 (Bank / Cheque Info) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Bank A/c No.
                  </label>
                  <input
                    type="text"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    placeholder="e.g. 77660100016031"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono font-medium dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Cheque / NEFT No.
                  </label>
                  <input
                    type="text"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder="Cheque or Txn Ref"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Cheque / Txn Date
                  </label>
                  <input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                  />
                </div>
              </div>

            </div>

            {/* Project & Party Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <FileText className="text-blue-600 dark:text-blue-400" size={20} /> Project & Coordinator Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Name of Project Coordinator & Department <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={coordinatorNameDept}
                    onChange={(e) => setCoordinatorNameDept(e.target.value)}
                    placeholder="e.g. Dr. A. K. Sharma (Computer Science & Engineering)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Name of the Project & Sanction Order Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectSanctionNo}
                    onChange={(e) => setProjectSanctionNo(e.target.value)}
                    placeholder="e.g. AI-Based Surveillance (Sanction: DST/SERB/2025/104)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Name of Funding Agency
                  </label>
                  <input
                    type="text"
                    value={fundingAgency}
                    onChange={(e) => setFundingAgency(e.target.value)}
                    placeholder="e.g. DST / SERB / MeitY / DRDO / ISRO"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                  />
                </div>
              </div>

              {/* Payee / Vendor Selection & Bank Details */}
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>To whom payment is to be made (Payee Name / M/s Firm) <span className="text-red-500">*</span></span>
                    {selectedPayeeId && selectedPayeeId !== 'custom' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} /> Registered Payee Selected
                      </span>
                    )}
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 space-y-1.5">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={payeeSearch}
                          onChange={(e) => setPayeeSearch(e.target.value)}
                          placeholder="Search saved payees..."
                          className="w-full pl-9 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                        />
                        {payeeSearch && (
                          <button
                            type="button"
                            onClick={() => setPayeeSearch('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedPayeeId}
                        onChange={(e) => handlePayeeSelect(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <option value="">-- Select Saved Payee / Vendor ({filteredSavedPayees.length}) --</option>
                        {filteredSavedPayees.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.payeeName || p.name} {p.accountNo ? `(${p.accountNo})` : ''}
                          </option>
                        ))}
                        <option value="custom">+ Custom / Enter New Payee</option>
                      </select>
                    </div>

                    <div className="md:col-span-7">
                      <input
                        type="text"
                        required
                        value={paymentTo}
                        onChange={(e) => {
                          setPaymentTo(e.target.value);
                          if (selectedPayeeId && selectedPayeeId !== 'custom') {
                            setSelectedPayeeId('custom');
                          }
                        }}
                        placeholder="e.g. M/s TechSolutions India Pvt. Ltd."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 4 Payee Bank Account Detail Fields */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={16} className="text-blue-600 dark:text-blue-400" /> Payee Bank Account Details
                      <span className="text-[11px] font-normal text-slate-500 lowercase">(auto from selection or fill manually if missing)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSavePayeeAccountDetails}
                      disabled={savingPayee || (!paymentTo && !payeeAccountName)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      title="Save entered payee bank details to database for future dropdown selection"
                    >
                      <Plus size={14} /> {savingPayee ? 'Saving...' : 'Add Member / Save Payee'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={payeeAccountName}
                        onChange={(e) => setPayeeAccountName(e.target.value)}
                        placeholder="e.g. TechSolutions India Pvt. Ltd."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Account No.
                      </label>
                      <input
                        type="text"
                        value={payeeAccountNo}
                        onChange={(e) => setPayeeAccountNo(e.target.value)}
                        placeholder="e.g. 398401009212"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-900 dark:text-white font-mono font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={payeeIfscCode}
                        onChange={(e) => setPayeeIfscCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SBIN0001012"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-900 dark:text-white font-mono uppercase font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Bank Name & Branch
                      </label>
                      <input
                        type="text"
                        value={payeeBankName}
                        onChange={(e) => setPayeeBankName(e.target.value)}
                        placeholder="e.g. SBI, MNNIT Branch"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Head-Wise Financial Balance Tracking Card */}
            {/* {headSnapshots.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-xl space-y-4 border border-slate-700/80">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 shrink-0">
                      <Wallet size={22} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                        Head-Wise Financial Balances
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Live balance tracking: Available = Sanctioned - Committed - Paid
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-bold px-3.5 py-1 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 size={14} /> Active Project Budget Heads
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {headSnapshots.map((snap, idx) => {
                    const isMatched = items.some(it => {
                      if (it.budgetHeadId && it.budgetHeadId === snap.budgetHeadId) return true;
                      if (it.headCategory) {
                        const itCategoryLower = String(it.headCategory).toLowerCase();
                        const snapNameLower = (snap.displayName || snap.headName || '').toLowerCase();
                        if (itCategoryLower === snapNameLower) return true;
                        if (getFriendlyHeadLabel(it.headCategory).toLowerCase() === getFriendlyHeadLabel(snap.displayName || snap.headName).toLowerCase()) return true;
                      }
                      return false;
                    });

                    const friendlyTitle = getFriendlyHeadLabel(snap.displayName || snap.headName);
                    const rawSubtitle = snap.displayName || snap.headName;

                    return (
                      <div
                        key={snap.budgetHeadId || idx}
                        className={`p-4 rounded-2xl border transition-all ${isMatched
                          ? 'bg-slate-800/95 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-800/40 border-slate-700/60 opacity-90 hover:opacity-100'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-slate-700/60">
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-sm text-blue-300 block tracking-wide truncate">
                              {friendlyTitle}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block font-medium truncate" title={rawSubtitle}>
                              ({rawSubtitle})
                            </span>
                          </div>
                          {isMatched && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 bg-blue-600 text-white rounded-md shadow-xs shrink-0 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Selected
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between gap-2 text-slate-200 whitespace-nowrap">
                            <span className="text-slate-400 font-sans text-xs shrink-0">Sanctioned:</span>
                            <span className="font-bold text-slate-100 text-xs shrink-0">{formatCurrency(snap.sanctioned)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-amber-300 whitespace-nowrap">
                            <span className="text-slate-400 font-sans text-xs shrink-0">Committed:</span>
                            <span className="font-bold text-xs shrink-0">{formatCurrency(snap.committed)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-emerald-400 whitespace-nowrap">
                            <span className="text-slate-400 font-sans text-xs shrink-0">Paid:</span>
                            <span className="font-bold text-xs shrink-0">{formatCurrency(snap.paid)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/80 font-bold whitespace-nowrap">
                            <span className="font-sans text-xs text-blue-300 shrink-0">Available:</span>
                            <span className="text-emerald-300 text-sm font-black shrink-0">{formatCurrency(snap.available)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )} */}

            {/* Account Details Table (Dynamic Itemized Line Items) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Receipt className="text-blue-600 dark:text-blue-400" size={20} /> Account Details & Invoice Items
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Optional Tax & Deduction Checkboxes */}
                  <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer text-amber-700 dark:text-amber-400">
                      <input
                        type="checkbox"
                        checked={showTdsGst}
                        onChange={(e) => setShowTdsGst(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                      />
                      <span>GST-TDS @ %</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-purple-700 dark:text-purple-400">
                      <input
                        type="checkbox"
                        checked={showTdsIt}
                        onChange={(e) => setShowTdsIt(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                      />
                      <span>IT TDS @ %</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 dark:text-rose-400">
                      <input
                        type="checkbox"
                        checked={showLd}
                        onChange={(e) => setShowLd(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 accent-rose-600"
                      />
                      <span>LD (Rs.)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1.5"
                  >
                    <Plus size={15} /> Add Line Item
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center">Sl.</th>
                      <th className="px-3 py-3 w-44">Letter No. & Date / MB No.</th>
                      <th className="px-3 py-3">Supplier, Invoice Details & Goods Name</th>
                      <th className="px-3 py-3 w-44">Payment Head / Cur Bal</th>
                      <th className="px-3 py-3 w-28 text-right">Gross Value (Rs.)</th>
                      <th className="px-3 py-3 w-28 text-right">Taxable (Rs.)</th>

                      {showTdsGst && (
                        <th className="px-3 py-3 w-28 text-right bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                          <div className="flex items-center justify-end gap-1">
                            <span>GST-TDS @</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={tdsGstRate}
                              onChange={(e) => setTdsGstRate(e.target.value)}
                              className="w-10 px-1 py-0.5 text-center bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-mono font-bold text-amber-700 dark:text-amber-300 outline-none"
                            />
                            <span>%</span>
                          </div>
                        </th>
                      )}

                      {showTdsIt && (
                        <th className="px-3 py-3 w-28 text-right bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300">
                          <div className="flex items-center justify-end gap-1">
                            <span>IT TDS @</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={tdsItRate}
                              onChange={(e) => setTdsItRate(e.target.value)}
                              className="w-10 px-1 py-0.5 text-center bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded text-xs font-mono font-bold text-purple-700 dark:text-purple-300 outline-none"
                            />
                            <span>%</span>
                          </div>
                        </th>
                      )}

                      {showLd && (
                        <th className="px-3 py-3 w-28 text-right bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
                          <div className="flex items-center justify-end gap-1">
                            <span>LD @</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={ldRate}
                              onChange={(e) => setLdRate(e.target.value)}
                              className="w-10 px-1 py-0.5 text-center bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded text-xs font-mono font-bold text-rose-700 dark:text-rose-300 outline-none"
                            />
                            <span>%</span>
                          </div>
                        </th>
                      )}

                      <th className="px-3 py-3 w-32 text-right">Bal After Pay</th>
                      <th className="px-3 py-3 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 text-center font-bold text-slate-500">
                          {index + 1}
                        </td>

                        {/* Letter No. & Date / MB No. */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={item.letterNoDateMbNo}
                            onChange={(e) => handleItemChange(index, 'letterNoDateMbNo', e.target.value)}
                            placeholder="e.g. Inv #102 dt 15-08-26"
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white text-xs"
                          />
                        </td>

                        {/* Supplier / Invoice / Goods details - Text Input Field */}
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={item.supplierInvoiceGoods}
                            onChange={(e) => handleItemChange(index, 'supplierInvoiceGoods', e.target.value)}
                            placeholder="Name of Supplier, Invoice Details & Goods Name"
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white text-xs font-medium"
                          />
                        </td>

                        {/* Payment Head & Current Balance */}
                        <td className="px-3 py-3 space-y-1">
                          <select
                            value={item.headCategory}
                            onChange={(e) => handleItemChange(index, 'headCategory', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            {headSnapshots.length > 0 ? (
                              headSnapshots.map((snap) => {
                                const val = snap.displayName || snap.headName || snap.customLabel;
                                const friendlyLabel = getFriendlyHeadLabel(val);
                                return (
                                  <option key={snap.budgetHeadId || val} value={val}>
                                    {friendlyLabel}
                                  </option>
                                );
                              })
                            ) : (
                              <>
                                <option value="Consumable">Consumable</option>
                                <option value="Contingency">Contingency</option>
                                <option value="Travel">Travel</option>
                                <option value="Equipment">Equipment</option>
                                <option value="Manpower">Manpower</option>
                                <option value="Overhead">Overhead</option>
                                <option value="SSR">SSR</option>
                                <option value="Miscellaneous/Other">Miscellaneous/Other</option>
                              </>
                            )}
                          </select>
                          <div className="flex items-center gap-1 mt-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider shrink-0">Avail Bal:</span>
                            <div className="relative flex-1 flex items-center">
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono font-medium mr-0.5">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.currentHeadBalance !== undefined && item.currentHeadBalance !== null ? item.currentHeadBalance : ''}
                                onChange={(e) => handleItemChange(index, 'currentHeadBalance', e.target.value)}
                                className="w-full px-1 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Gross Value (Rs.) */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.grossValue || ''}
                            onChange={(e) => handleItemChange(index, 'grossValue', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* Taxable Amount (Bill Amount) */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.billAmount || ''}
                            onChange={(e) => handleItemChange(index, 'billAmount', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>



                        {/* Optional TDS GST */}
                        {showTdsGst && (
                          <td className="px-3 py-3 bg-amber-50/30 dark:bg-amber-950/10">
                            <input
                              type="number"
                              step="0.01"
                              value={item.tdsGst}
                              onChange={(e) => handleItemChange(index, 'tdsGst', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-right font-mono text-amber-600 dark:text-amber-400 font-medium"
                            />
                          </td>
                        )}

                        {/* Optional IT TDS */}
                        {showTdsIt && (
                          <td className="px-3 py-3 bg-purple-50/30 dark:bg-purple-950/10">
                            <input
                              type="number"
                              step="0.01"
                              value={item.tdsIt}
                              onChange={(e) => handleItemChange(index, 'tdsIt', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-lg text-right font-mono text-purple-600 dark:text-purple-400 font-medium"
                            />
                          </td>
                        )}

                        {/* Optional LD Amount */}
                        {showLd && (
                          <td className="px-3 py-3 bg-rose-50/30 dark:bg-rose-950/10">
                            <input
                              type="number"
                              step="0.01"
                              value={item.ldAmount}
                              onChange={(e) => handleItemChange(index, 'ldAmount', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 rounded-lg text-right font-mono text-rose-600 dark:text-rose-400 font-medium"
                            />
                          </td>
                        )}

                        {/* Balance After Payment */}
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(item.balanceAfterPayment)}
                        </td>

                        {/* Delete Action */}
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => removeItemRow(index)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.some((it) => (parseFloat(it.billAmount) || 0) > (parseFloat(it.currentHeadBalance) || 0)) && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-3 shadow-xs">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Budget Over-Availability Notice:</strong> One or more line item amounts exceed the current available balance for the selected budget head. Please double check the allocation or request budget re-allocation if necessary.
                  </span>
                </div>
              )}
            </div>


            {/* Payment Summary & Breakdown Box */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">

              {/* Payment Disbursement Breakdown */}
              <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  Payment Disbursement Details
                </h4>

                <div className="space-y-3 font-mono text-sm">
                  {/* Gross Value */}
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800 font-sans font-extrabold text-slate-900 dark:text-white">
                    <span className="text-xs uppercase tracking-wider text-blue-900 dark:text-blue-200 font-bold">Gross Value</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 text-base">
                      {formatCurrency(totalGrossAmount || totalTaxableAmount)}
                    </span>
                  </div>

                  {/* Taxable Value */}
                  <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-300 font-sans font-medium text-xs">
                      Taxable Value
                    </span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {formatCurrency(totalTaxableAmount)}
                    </span>
                  </div>

                  {/* GST-TDS */}
                  {showTdsGst && totalTdsGst > 0 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
                      <span className="text-slate-600 dark:text-slate-300 font-sans font-medium text-xs">
                        GST-TDS (@ {tdsGstRate}%)
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(totalTdsGst)}
                      </span>
                    </div>
                  )}

                  {/* IT TDS */}
                  {showTdsIt && totalTdsIt > 0 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-purple-200 dark:border-purple-800/50">
                      <span className="text-slate-600 dark:text-slate-300 font-sans font-medium text-xs">
                        IT TDS (@ {tdsItRate}%)
                      </span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(totalTdsIt)}
                      </span>
                    </div>
                  )}

                  {/* LD Charged */}
                  {showLd && totalLdAmount > 0 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50">
                      <span className="text-slate-600 dark:text-slate-300 font-sans font-medium text-xs">
                        LD Charged (@ {ldRate}%)
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(totalLdAmount)}
                      </span>
                    </div>
                  )}

                  {/* Payment to M/s Firm */}
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 font-sans font-extrabold text-slate-900 dark:text-white">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Payment to M/s Firm ({paymentTo || 'Name of Firm'})
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                      {formatCurrency(netPayableToFirm)}
                    </span>
                  </div>
                </div>

                {/* Amount in Words */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Amount in Words (Rs.)
                  </label>
                  <input
                    type="text"
                    value={manualWords || generatedWords}
                    onChange={(e) => setManualWords(e.target.value)}
                    placeholder="Amount in words"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold italic text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Payment Voucher Workflow Guide Graphic */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    Payment Voucher Workflow
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Simple Process
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">1</div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Create & Print Preview</div>
                      <div className="text-[10px] text-slate-400">Fill details & download/print simple preview</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs">2</div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Upload Signed Document</div>
                      <div className="text-[10px] text-slate-400">Upload scanned/signed copy of voucher</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">3</div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Approve Voucher</div>
                      <div className="text-[10px] text-slate-400">Approve payment to complete process</div>
                    </div>
                  </div>
                </div>

                {/* Important Note Box */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
                    <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" /> Important Note
                  </div>
                  <p className="font-medium text-[11px] pl-5">
                    Before uploading the Payment Voucher document, ensure that all required members/signatories have signed the document. Once uploaded, the document cannot be replaced.
                  </p>
                </div>
              </div>


            </div>

            {/* Bottom Form Actions */}
            <div className="flex flex-wrap items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 active:scale-95"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></div>
                      <span>Submitting Voucher...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Submit Payment Voucher</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>

        </div>
      ) : (
        /* HISTORY & STATUS TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-colors space-y-4 p-6">

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by Voucher No, Coordinator, Firm..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPageNumber(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPageNumber(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading payment vouchers...</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <Receipt size={40} className="text-slate-400 mb-3" />
              <p className="text-slate-600 dark:text-slate-300 font-bold">No payment vouchers found.</p>
              <p className="text-xs text-slate-400 mt-1">Switch to the "Create Payment Voucher" tab to create one.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-4">Voucher No</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Project Coordinator & Dept</th>
                      <th className="px-5 py-4">Payee / Firm Name</th>
                      <th className="px-5 py-4 text-right">Taxable / Payable (₹)</th>
                      <th className="px-5 py-4">Stage / Status</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredVouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-bold text-blue-600 dark:text-blue-400 font-mono">
                          {v.voucherNo}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium text-xs">
                          {v.date}
                        </td>
                        <td className="px-5 py-4 max-w-xs truncate font-medium text-slate-800 dark:text-slate-200">
                          {v.coordinatorNameDept}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300">
                          {v.paymentTo}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <div className="text-xs text-slate-500 font-medium">Taxable: {formatCurrency(v.taxableAmount || v.amount)}</div>
                          <div className="text-blue-600 dark:text-blue-400 font-extrabold">Payable: {formatCurrency(v.payableAmount || v.amount)}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border w-max ${v.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : v.status === 'Draft'
                                ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                              {v.status}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">Stage: {v.status === 'Approved' ? 'Approved' : (getSignedFiles(v).length > 0 ? 'Document Uploaded' : 'Pending Document Upload')}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center space-x-1.5 flex items-center justify-center flex-wrap gap-1.5">
                          <button
                            onClick={() => setPreviewVoucher(v)}
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="View printable voucher"
                          >
                            <Eye size={14} /> View / Print
                          </button>

                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            id={`inline_file_upload_${v.id}`}
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadSignedCopy(e.target.files[0], v);
                                e.target.value = '';
                              }
                            }}
                          />

                          {getSignedFiles(v).length > 0 ? (
                            <>
                              <a
                                href={getSignedFiles(v)[getSignedFiles(v).length - 1].dataUrl}
                                download={getSignedFiles(v)[getSignedFiles(v).length - 1].fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800"
                                title="View / Download Signed Document"
                              >
                                <Paperclip size={14} /> View Document ({getSignedFiles(v).length})
                              </a>

                              {v.status !== 'Approved' ? (
                                <>
                                  <button
                                    onClick={() => handleApproveVoucher(v)}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm active:scale-95 cursor-pointer"
                                    title="Approve Payment Voucher"
                                  >
                                    <CheckCircle2 size={14} /> Approve
                                  </button>
                                  <label
                                    htmlFor={`inline_file_upload_${v.id}`}
                                    className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Re-upload signed copy"
                                  >
                                    <Upload size={13} /> Re-upload
                                  </label>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <label
                              htmlFor={`inline_file_upload_${v.id}`}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm active:scale-95"
                              title="Choose signed voucher file to upload"
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
              {totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 font-medium">
                    Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min((pageNumber - 1) * pageSize + 1, totalCount)}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(pageNumber * pageSize, totalCount)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount}</span> entries
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      Previous
                    </button>

                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2">
                      Page {pageNumber} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={pageNumber >= totalPages}
                      onClick={() => setPageNumber((prev) => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* OFFICIAL PRINT / PREVIEW MODAL */}
      {previewVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-overlay">
          {/* PRINT STYLES FOR COMPACT SINGLE-PAGE A4 OUTPUT */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm 8mm 10mm;
              }
              html, body {
                height: auto !important;
                overflow: visible !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Hide all page content except the printable voucher sheet */
              body * {
                visibility: hidden !important;
              }
              #printable-voucher-document,
              #printable-voucher-document * {
                visibility: visible !important;
              }
              #printable-voucher-document {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
              }
              .print-avoid-break {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `}</style>

          <div className="bg-slate-200 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col print-modal-card">

            {/* Modal Header Bar - Hidden on Print */}
            <div className="p-3 px-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 z-10 no-print print-modal-header shadow-sm">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Printer size={18} className="text-blue-600 dark:text-blue-400" /> Printable Payment Voucher Preview (Single Page A4 Format)
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  id={`preview_file_upload_${previewVoucher.id}`}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadSignedCopy(e.target.files[0], previewVoucher);
                      e.target.value = '';
                    }
                  }}
                />
                {getSignedFiles(previewVoucher).length > 0 ? (
                  <a
                    href={getSignedFiles(previewVoucher)[getSignedFiles(previewVoucher).length - 1].dataUrl}
                    download={getSignedFiles(previewVoucher)[getSignedFiles(previewVoucher).length - 1].fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 dark:text-purple-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border border-purple-300 dark:border-purple-800"
                  >
                    <Paperclip size={14} /> Download Signed Copy ({getSignedFiles(previewVoucher).length})
                  </a>
                ) : (
                  <label
                    htmlFor={`preview_file_upload_${previewVoucher.id}`}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Upload size={14} /> Upload Signed Copy
                  </label>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Printer size={15} /> Print Voucher
                </button>
                <button
                  onClick={() => setPreviewVoucher(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet (Exact A4 Dimensions Preview Box) */}
            <div className="my-4 mx-auto w-full max-w-[210mm] min-h-[297mm] p-6 sm:p-8 bg-white text-slate-900 shadow-xl rounded-sm border border-slate-300 space-y-3.5 font-serif text-[11px] leading-snug" id="printable-voucher-document">

              {/* Document Header */}
              <div className="text-center space-y-0.5 border-b-2 border-slate-900 pb-2">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                  Office of the Dean (Research & Consultancy)
                </h2>
                <h1 className="text-sm sm:text-base font-extrabold uppercase">
                  Motilal Nehru National Institute of Technology Allahabad
                </h1>
                <p className="text-[11px] font-semibold">Prayagraj - 211004 (U.P.)</p>
                <div className="pt-1 text-xs font-bold underline uppercase tracking-wider">
                  {previewVoucher.voucherType === 'above100k'
                    ? 'Project Payment Voucher (More than ₹ 1,00,000/-)'
                    : 'Project Payment Voucher (Up to ₹ 1,00,000/-)'}
                </div>
              </div>

              {/* Document Top Metas */}
              <div className="grid grid-cols-2 text-[11px] font-sans space-y-0.5">
                <div>
                  <p><span className="font-bold">Voucher No:</span> {previewVoucher.voucherNo}</p>
                  <p><span className="font-bold">Date:</span> {previewVoucher.date}</p>
                  <p><span className="font-bold">Gross Value (Rs.):</span> {formatCurrency(previewVoucher.grossValue || previewVoucher.totalAmount || previewVoucher.amount)}</p>
                  <p><span className="font-bold">Taxable Values (Rs.):</span> {formatCurrency(previewVoucher.taxableAmount || previewVoucher.amount)}</p>
                  <p><span className="font-bold">Net Payment / Pay to Party (Rs.):</span> {formatCurrency(previewVoucher.payableAmount || previewVoucher.payRs || previewVoucher.amount)}</p>
                </div>
                <div className="text-right">
                  <p><span className="font-bold">Bank A/c No.:</span> {previewVoucher.bankAccountNo}</p>
                  <p><span className="font-bold">Cheque / Txn No.:</span> {previewVoucher.chequeNo || 'N/A'}</p>
                  <p><span className="font-bold">Cheque / Txn Date:</span> {previewVoucher.chequeDate}</p>
                </div>
              </div>

              {/* Coordinator & Project Details */}
              <div className="text-[11px] space-y-1 font-sans border-t border-slate-300 pt-2">
                <p><span className="font-bold">Name of Project Coordinator & Department:</span> {previewVoucher.coordinatorNameDept}</p>
                <p><span className="font-bold">Name of the Project & Sanction Order Number:</span> {previewVoucher.projectSanctionNo}</p>
                <p><span className="font-bold">Name of Funding Agency:</span> {previewVoucher.fundingAgency || 'N/A'}</p>
                <p><span className="font-bold">To whom payment is to be made:</span> {previewVoucher.paymentTo}</p>
                {(previewVoucher.payeeAccountNo || previewVoucher.payeeBankName || previewVoucher.payeeAccountName) && (
                  <p className="text-[10px]">
                    <span className="font-bold">Payee Bank Account Details:</span> A/c Name: <span className="font-semibold">{previewVoucher.payeeAccountName || previewVoucher.paymentTo}</span> | A/c No: <span className="font-mono font-bold">{previewVoucher.payeeAccountNo || 'N/A'}</span> | IFSC: <span className="font-mono font-bold">{previewVoucher.payeeIfscCode || 'N/A'}</span> | Bank: <span className="font-semibold">{previewVoucher.payeeBankName || 'N/A'}</span>
                  </p>
                )}
              </div>

              {/* Account Details Table */}
              <div className="pt-1">
                <table className="w-full text-[10px] font-sans border-collapse border border-slate-900">
                  <thead>
                    <tr className="bg-slate-100 text-center font-bold border-b border-slate-900">
                      <th className="border border-slate-900 p-1 w-8">Sl. No.</th>
                      <th className="border border-slate-900 p-1">Letter No. & Date / MB No.</th>
                      <th className="border border-slate-900 p-1">Name of Supplier, Invoice Details & Goods Name</th>
                      <th className="border border-slate-900 p-1">Payment Head / Cur Bal (Rs)</th>
                      <th className="border border-slate-900 p-1">Taxable (Rs.)</th>
                      {(previewVoucher.showGst || (previewVoucher.items && previewVoucher.items.some(i => i.gstAmount > 0))) && (
                        <th className="border border-slate-900 p-1">GST Amount</th>
                      )}
                      {(previewVoucher.showTdsGst || (previewVoucher.items && previewVoucher.items.some(i => i.tdsGst > 0))) && (
                        <th className="border border-slate-900 p-1">TDS Amount</th>
                      )}
                      {(previewVoucher.showTdsIt || (previewVoucher.items && previewVoucher.items.some(i => i.tdsIt > 0))) && (
                        <th className="border border-slate-900 p-1">IT TDS Amount</th>
                      )}
                      {(previewVoucher.showLd || (previewVoucher.items && previewVoucher.items.some(i => i.ldAmount > 0))) && (
                        <th className="border border-slate-900 p-1">LD Deduction</th>
                      )}
                      <th className="border border-slate-900 p-1">Head Balance After Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewVoucher.items || []).map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-900 text-slate-900">
                        <td className="border border-slate-900 p-1 text-center font-bold">{idx + 1}</td>
                        <td className="border border-slate-900 p-1">{it.letterNoDateMbNo}</td>
                        <td className="border border-slate-900 p-1">{it.supplierInvoiceGoods}</td>
                        <td className="border border-slate-900 p-1 font-semibold">
                          {it.headCategory} <br />
                          <span className="text-[9px] text-slate-600">(Bal: ₹{it.currentHeadBalance})</span>
                        </td>
                        <td className="border border-slate-900 p-1 text-right font-mono font-bold">₹{it.billAmount}</td>
                        {(previewVoucher.showGst || (previewVoucher.items && previewVoucher.items.some(i => i.gstAmount > 0))) && (
                          <td className="border border-slate-900 p-1 text-right font-mono">₹{it.gstAmount || 0}</td>
                        )}
                        {(previewVoucher.showTdsGst || (previewVoucher.items && previewVoucher.items.some(i => i.tdsGst > 0))) && (
                          <td className="border border-slate-900 p-1 text-right font-mono">₹{it.tdsGst || 0}</td>
                        )}
                        {(previewVoucher.showTdsIt || (previewVoucher.items && previewVoucher.items.some(i => i.tdsIt > 0))) && (
                          <td className="border border-slate-900 p-1 text-right font-mono">₹{it.tdsIt || 0}</td>
                        )}
                        {(previewVoucher.showLd || (previewVoucher.items && previewVoucher.items.some(i => i.ldAmount > 0))) && (
                          <td className="border border-slate-900 p-1 text-right font-mono">₹{it.ldAmount || 0}</td>
                        )}
                        <td className="border border-slate-900 p-1 text-right font-mono">{formatCurrency(it.balanceAfterPayment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment Breakdown & Summary Box */}
              <div className="font-sans text-[11px] border border-slate-900 p-2.5 space-y-1 print-avoid-break">
                <p className="font-bold">Payment to:</p>
                <div className="pl-3 space-y-0.5">
                  <p>1. {previewVoucher.paymentTo?.startsWith('M/s') ? previewVoucher.paymentTo : `M/s ${previewVoucher.paymentTo}`} — <span className="font-bold font-mono">{formatCurrency(previewVoucher.firmPaymentAmount)}</span></p>
                  <p>2. Payment (TDS) transfer to BOB MNNIT Branch — <span className="font-bold font-mono">{formatCurrency(previewVoucher.bobTransferAmount)}</span></p>
                  {(previewVoucher.totalLdDeduction > 0 || (previewVoucher.items && previewVoucher.items.some(i => i.ldAmount > 0))) && (
                    <p>3. Liquidated Damages (LD) Deductions — <span className="font-bold font-mono">{formatCurrency(previewVoucher.totalLdDeduction || previewVoucher.items?.reduce((s, i) => s + (i.ldAmount || 0), 0))}</span></p>
                  )}
                  <p className="font-bold pt-0.5 border-t border-slate-300">Total Gross Amount: <span className="font-mono">{formatCurrency(previewVoucher.totalAmount || previewVoucher.grossValue)}</span></p>
                </div>
                <p className="pt-1 font-semibold">{previewVoucher.amountInWords}</p>
              </div>

              {/* Signatory Placeholders */}
              <div className="pt-6 font-sans font-bold uppercase text-[9.5px] space-y-8 print-avoid-break">
                {/* Row 1: 3 Signatures in one line */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="border-t border-slate-900 pt-1.5">Office Assistant</div>
                  <div className="border-t border-slate-900 pt-1.5">Superintendent</div>
                  <div className="border-t border-slate-900 pt-1.5">Deputy Registrar</div>
                </div>

                {/* Row 2: Centered Dean (R&C) if <= 1L, or Side-by-Side Dean & Director if > 1L */}
                {previewVoucher.voucherType === 'above100k' || (previewVoucher.amount && previewVoucher.amount > 100000) ? (
                  <div className="flex items-center justify-between px-12 text-center">
                    <div className="border-t border-slate-900 pt-1.5 w-44">Dean (R&C)</div>
                    <div className="border-t border-slate-900 pt-1.5 w-44 font-extrabold text-blue-950">Director</div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-center">
                    <div className="border-t border-slate-900 pt-1.5 w-52">Dean (R&C)</div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
