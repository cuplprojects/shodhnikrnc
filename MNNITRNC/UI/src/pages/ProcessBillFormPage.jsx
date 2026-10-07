import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIndent, processBill, getIndentBudget } from '../api/procurementApi';
import { getPaymentVouchers } from '../api/paymentVoucherApi';
import { listNotings } from '../api/notingApi';
import { getWorkflowInstanceByRequest, actionWorkflow } from '../api/workflowApi';
import { listDealingAssistantOptions } from '../api/proposalsApi';
import { useAuth } from '../auth/useAuth';
import ApprovalTimeline from '../components/ApprovalTimeline';
import DocumentUploader from '../components/DocumentUploader';
import { uploadDocument } from '../api/documentsApi';
import { getProject } from '../api/projectsApi';
import { apiBlob, BASE_URL, stripBaseUrl } from '../api/apiClient';
import ViewManpowerDocumentModal from './projects/components/ViewManpowerDocumentModal';
import { Eye, Download, User, PenLine, CheckCircle2, XCircle, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import { getModeOfPurchaseText } from './NotingPage';


const DEFAULT_CLERKS = [
  { userId: 'harshit1', fullName: 'Harshit', userName: 'harshit1' },
  { userId: 'sadhvi1', fullName: 'Sadhvi', userName: 'sadhvi1' },
  { userId: 'ashok1', fullName: 'Ashok', userName: 'ashok1' },
  { userId: 'shyamu1', fullName: 'Shyamu', userName: 'shyamu1' },
  { userId: 'renu1', fullName: 'Renu', userName: 'renu1' },
  { userId: 'prateek1', fullName: 'Prateek', userName: 'prateek1' },
];

export default function ProcessBillFormPage() {
  const { indentType, indentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [indent, setIndent] = useState(null);
  const [billWorkflow, setBillWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missingFieldsList, setMissingFieldsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [projectDetails, setProjectDetails] = useState(null);
  const [budgetSnapshot, setBudgetSnapshot] = useState(null);

  const [remarks, setRemarks] = useState('');
  const [clerkOptions, setClerkOptions] = useState(DEFAULT_CLERKS);
  const [selectedClerkId, setSelectedClerkId] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const todayDateStr = new Date().toISOString().split('T')[0];

  const [vouchersList, setVouchersList] = useState([]);
  const [notingsList, setNotingsList] = useState([]);

  const [formData, setFormData] = useState({
    billNo: '',
    billAmount: '',
    billFile: null,
    generationDate: todayDateStr,
    itemReceivingDate: '',
    originalBillReference: '',
    stockEntryConfirmed: false,
    eWayBillNumber: '',
    eWayBillFile: null,
    measurementBookNumber: '',
    stockBookPage: '',
    stockDescription: '',
    stockQuantity: '',
    stockActualCost: '',
    stockCondition: '',
    satisfactoryCertificateFile: null,
    conditionRemarks: '',
    miscellaneousExpenditure: '',
    purchaseOrderNumber: '',
    purchaseOrderDate: '',
    bindingLocation: 'Prayagraj',
    comparativeStatementNumber: '',
    comparativeStatementSigned: false,
    eWayBillPartA: '',
    eWayBillPartB: '',
  });

  const hasPaymentVoucher = useMemo(() => {
    if (!Array.isArray(vouchersList) || vouchersList.length === 0) return false;
    const targetGuid = indent?.id ? String(indent.id).toLowerCase().trim() : '';
    const targetParamId = indentId ? String(indentId).toLowerCase().trim() : '';
    const billRefNo = (formData?.billNo || indent?.billNo || indent?.originalBillReference || '').toLowerCase().trim();
    const indentNo = (indent?.indentNumber || indent?.indentNo || '').toLowerCase().trim();

    return vouchersList.some(v => {
      const vIndentId = v.indentId ? String(v.indentId).toLowerCase().trim() : '';

      // 1. Exact match on stored IndentId (GUID or URL parameter ID)
      if (vIndentId) {
        if (targetGuid && vIndentId === targetGuid) return true;
        if (targetParamId && vIndentId === targetParamId) return true;
      }

      // 2. Exact match on voucher items for "Bill Ref: <billNo>" or "<indentNo>"
      return (v.items || []).some(it => {
        const letterRef = String(it.letterNoDateMbNo || '').toLowerCase().trim();
        if (billRefNo && billRefNo.length >= 1) {
          if (letterRef === `bill ref: ${billRefNo}` || letterRef === billRefNo) return true;
        }
        if (indentNo && indentNo.length >= 2) {
          if (letterRef.includes(indentNo)) return true;
        }
        return false;
      });
    });
  }, [vouchersList, indentId, indent, formData.billNo]);

  const hasNoting = useMemo(() => {
    if (!Array.isArray(notingsList) || notingsList.length === 0) return false;
    const targetGuid = indent?.id ? String(indent.id).toLowerCase().trim() : '';
    const targetParamId = indentId ? String(indentId).toLowerCase().trim() : '';
    const billRefNo = (formData?.billNo || indent?.billNo || indent?.originalBillReference || '').toLowerCase().trim();
    const indentNo = (indent?.indentNumber || indent?.indentNo || '').toLowerCase().trim();

    return notingsList.some(n => {
      return (n.items || []).some(it => {
        const indentDateRef = String(it.indentNoAndDate || '').toLowerCase().trim();
        if (indentNo && indentNo.length >= 2 && indentDateRef.includes(indentNo)) return true;
        if (billRefNo && billRefNo.length >= 1 && indentDateRef.includes(billRefNo)) return true;
        if (targetParamId && targetParamId.length >= 2 && indentDateRef.includes(targetParamId)) return true;
        if (targetGuid && targetGuid.length >= 5 && indentDateRef.includes(targetGuid)) return true;
        return false;
      });
    });
  }, [notingsList, indentId, indent, formData.billNo]);

  const getFileName = (fileOrUrl) => {
    if (!fileOrUrl) return '';
    if (fileOrUrl instanceof File) return fileOrUrl.name;
    if (typeof fileOrUrl === 'string') {
      if (fileOrUrl.includes('download')) return 'Uploaded Document';
      const parts = fileOrUrl.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanName = decodeURIComponent(lastPart.split('?')[0]);
      return cleanName || 'Uploaded File';
    }
    return String(fileOrUrl);
  };

  const handleViewFile = (fileOrUrl, title = 'Document') => {
    if (!fileOrUrl) return;
    if (fileOrUrl instanceof File) {
      const objectUrl = URL.createObjectURL(fileOrUrl);
      setPreviewDoc({ title, url: objectUrl });
    } else if (typeof fileOrUrl === 'string') {
      // Passed through as-is (relative "/api/documents/..." or already
      // absolute) -- ViewManpowerDocumentModal's stripBaseUrl resolves
      // either shape correctly. Resolving it here too, against a baseUrl
      // that includes BASE_URL's own path segment (e.g. "/API" in
      // production), previously discarded that segment via the URL
      // constructor's absolute-path resolution rules.
      setPreviewDoc({ title, url: fileOrUrl });
    }
  };

  const handleDownloadFile = async (fileOrUrl, title = 'Document') => {
    if (!fileOrUrl) return;
    if (fileOrUrl instanceof File) {
      const url = URL.createObjectURL(fileOrUrl);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileOrUrl.name || `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else if (typeof fileOrUrl === 'string') {
      try {
        const path = stripBaseUrl(fileOrUrl);
        const blob = await apiBlob(path);
        const downloadUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${title}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } catch (err) {
        const absoluteUrl = fileOrUrl.startsWith('http') ? fileOrUrl : `${BASE_URL}${stripBaseUrl(fileOrUrl)}`;
        window.open(absoluteUrl, '_blank');
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [indentType, indentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setMissingFieldsList([]);

      getPaymentVouchers({ pageSize: 0 }).then(vData => setVouchersList(vData?.items || (Array.isArray(vData) ? vData : []))).catch(() => { });
      listNotings({ pageSize: 0 }).then(nData => setNotingsList(nData?.items || (Array.isArray(nData) ? nData : []))).catch(() => { });
      const rawType = indentType || 'Contingency';
      const formattedType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

      const [indentData, workflowData] = await Promise.all([
        getIndent(formattedType, indentId),
        getWorkflowInstanceByRequest(formattedType, indentId, 'Bill', { silent: true }).catch(() => null),
      ]);

      if (!indentData) {
        throw new Error('Indent details could not be found.');
      }
      setIndent({
        ...indentData,
        indentType: formattedType,
        name: indentData.name || (indentData.place ? `Travel to ${indentData.place}${indentData.purpose ? ` (${indentData.purpose})` : ''}` : ''),
        estimatedCost: indentData.estimatedCost || indentData.expectedCost || 0,
      });
      setBillWorkflow(workflowData);

      setFormData((prev) => ({
        ...prev,
        billNo: indentData.billNo || indentData.billNumber || indentData.originalBillReference || prev.billNo,
        billAmount: indentData.billAmount ? String(indentData.billAmount) : prev.billAmount,
        generationDate: indentData.generationDate || indentData.billDate || prev.generationDate,
        itemReceivingDate: indentData.itemReceivingDate || indentData.receivedDate || prev.itemReceivingDate,
        originalBillReference: indentData.originalBillReference || indentData.billNo || prev.originalBillReference,
        stockEntryConfirmed: indentData.stockEntryConfirmed ?? prev.stockEntryConfirmed,
        eWayBillNumber: indentData.eWayBillNumber || prev.eWayBillNumber,
        eWayBillFile: indentData.eWayBillFileUrl || indentData.eWayBillDocumentUrl || indentData.eWayBillFile || prev.eWayBillFile,
        measurementBookNumber: indentData.measurementBookNumber || prev.measurementBookNumber,
        stockBookPage: indentData.stockBookPage || prev.stockBookPage,
        stockDescription: indentData.stockDescription || prev.stockDescription,
        stockQuantity: indentData.stockQuantity || prev.stockQuantity,
        stockActualCost: indentData.stockActualCost || prev.stockActualCost,
        stockCondition: indentData.stockCondition || prev.stockCondition,
        satisfactoryCertificateFile: indentData.satisfactoryCertificateFileUrl || indentData.satisfactoryCertificateFile || prev.satisfactoryCertificateFile,
        purchaseOrderNumber: indentData.purchaseOrderNumber || prev.purchaseOrderNumber,
        purchaseOrderDate: indentData.purchaseOrderDate || prev.purchaseOrderDate,
        bindingLocation: indentData.bindingLocation || prev.bindingLocation,
        comparativeStatementNumber: indentData.comparativeStatementNumber || prev.comparativeStatementNumber,
        comparativeStatementSigned: indentData.comparativeStatementSigned ?? prev.comparativeStatementSigned,
        billFile: indentData.billFileUrl || indentData.billDocumentUrl || indentData.billFile || prev.billFile,
      }));

      // Fetch project details if projectId exists
      if (indentData.projectId) {
        getProject(indentData.projectId)
          .then((pData) => {
            if (pData) setProjectDetails(pData);
          })
          .catch(() => { });
      }

      // Fetch budget snapshot if budgetHeadId exists
      if (indentData.budgetHeadId) {
        getIndentBudget(indentData.budgetHeadId)
          .then((bData) => {
            if (bData) setBudgetSnapshot(bData);
          })
          .catch(() => { });
      }

      // Fetch regular staff options for clerk assignment
      listDealingAssistantOptions()
        .then((options) => {
          if (options && options.length > 0) {
            setClerkOptions(options);
          }
        })
        .catch(() => { });
    } catch (err) {
      console.error('Failed to load details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch details.');
    } finally {
      setLoading(false);
    }
  };

  const isProductType = (() => {
    if (!indent) return true;
    if (indent.gemCategoryType !== undefined && indent.gemCategoryType !== null) {
      if (typeof indent.gemCategoryType === 'string') return indent.gemCategoryType.toLowerCase() === 'product';
      if (indent.gemCategoryType === 1) return false;
      if (indent.gemCategoryType === 0) return true;
    }
    if (indent.categoryType) return indent.categoryType.toLowerCase() === 'product';
    if (indent.nature) return indent.nature.toLowerCase() === 'product';
    if (indent.indentType === 'Contingency' && (indent.isService || indent.serviceType)) return false;
    if ((indent.indentType || '').toLowerCase() === 'travel') return false;
    return true;
  })();

  const isGemAvailable = (() => {
    if (!indent) return false;
    const avail = (indent.gemAvailability || '').toString().trim().toLowerCase();
    if (avail === 'yes' || avail === 'true') return true;
    if (avail === 'no' || avail === 'false') return false;
    return (indent.indentType || '').toLowerCase() === 'gem';
  })();

  const estimatedCostNum = parseFloat(indent?.estimatedCost || 0);
  const maxAllowedAmount = estimatedCostNum * 1.10;

  const currentBillAmountVal = parseFloat(formData.billAmount || 0);
  const effectiveEWayAmountVal = parseFloat(formData.billAmount) || parseFloat(indent?.estimatedCost || 0);
  const isEWayMandatoryRule = isProductType && effectiveEWayAmountVal > 50000;
  const isBillAmountExceeded = currentBillAmountVal > maxAllowedAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!indent) return;

    if (indent.currentStage !== 'Approved' && indent.currentStage !== 'IndentApproved') {
      setError('Please first Approve the indent then bill process will be start');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setError(null);
    setMissingFieldsList([]);
    const amountNum = parseFloat(formData.billAmount || 0);
    const missing = [];

    // Section 1 bill fields are mandatory for all indents
    if (!isBillRaised) {
      if (!formData.billNo || !formData.billNo.trim()) {
        missing.push('Bill No./Invoice No./Tax Invoice No is required');
      }

      if (!formData.billAmount || isNaN(amountNum) || amountNum <= 0) {
        missing.push('Valid Bill Amount (₹) is required');
      }

      if (!formData.generationDate) {
        missing.push('Bill Date is required');
      }

      if (!formData.itemReceivingDate) {
        missing.push('Item Receiving Date is required');
      }

      if (!formData.billFile && !indent?.billFileUrl) {
        missing.push('Bill Upload Document File (PDF / Image) is required');
      }

      if (amountNum > 0 && amountNum > maxAllowedAmount) {
        missing.push(`Bill Amount (₹${amountNum.toLocaleString('en-IN')}) cannot exceed max limit of ₹${maxAllowedAmount.toLocaleString('en-IN')} (Estimated Cost ₹${estimatedCostNum.toLocaleString('en-IN')} + 10%)`);
      }

      if (isProductType && isEWayMandatoryRule) {
        if (!formData.eWayBillNumber || !formData.eWayBillNumber.trim()) {
          missing.push('E-Way Bill Number is required for product bills exceeding ₹50,000');
        }
        if (!formData.eWayBillFile && !indent?.eWayBillFileUrl) {
          missing.push('E-Way Bill File Upload is required for product bills exceeding ₹50,000');
        }
      }
    }

    // Stock Register Entry mandatory validation (for both GeM and Non-GeM)
    if (isApproved) {
      if (!formData.stockBookPage || !formData.stockBookPage.trim()) {
        missing.push('Stock Book Page No. and Date is required');
      }
      if (!formData.stockDescription || !formData.stockDescription.trim()) {
        missing.push('Stock Description is required');
      }
      if (!formData.stockQuantity || !formData.stockQuantity.trim()) {
        missing.push('Stock Quantity is required');
      }
      if (!formData.stockActualCost || !formData.stockActualCost.trim()) {
        missing.push('Stock Actual Cost is required');
      }
      if (!formData.stockCondition || !formData.stockCondition.trim()) {
        missing.push('Stock Condition is required');
      }
      if (formData.stockCondition === 'Satisfactory' && !formData.satisfactoryCertificateFile && !indent?.satisfactoryCertificateFileUrl) {
        missing.push('Satisfactory Certificate file upload is required when Condition is Satisfactory');
      }
    }


    if (missing.length > 0) {
      setMissingFieldsList(missing);
      setError('Please fill in all mandatory fields before processing the bill:');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setMissingFieldsList([]);

      let billFileUrl = typeof formData.billFile === 'string' ? formData.billFile : null;
      if (formData.billFile instanceof File) {
        const uploadData = new FormData();
        uploadData.append('File', formData.billFile);
        uploadData.append('OwnerType', `${indent.indentType}Indent`);
        uploadData.append('OwnerId', indent.id);
        uploadData.append('Kind', 'BillDocument');
        const docId = await uploadDocument(uploadData);
        billFileUrl = `/api/documents/${docId}/download`;
      }

      let eWayBillFileUrl = typeof formData.eWayBillFile === 'string' ? formData.eWayBillFile : null;
      if (formData.eWayBillFile instanceof File) {
        const uploadData = new FormData();
        uploadData.append('File', formData.eWayBillFile);
        uploadData.append('OwnerType', `${indent.indentType}Indent`);
        uploadData.append('OwnerId', indent.id);
        uploadData.append('Kind', 'EWayBill');
        const docId = await uploadDocument(uploadData);
        eWayBillFileUrl = `/api/documents/${docId}/download`;
      }

      let satisfactoryCertificateFileUrl = typeof formData.satisfactoryCertificateFile === 'string' ? formData.satisfactoryCertificateFile : null;
      if (formData.satisfactoryCertificateFile instanceof File) {
        const uploadData = new FormData();
        uploadData.append('File', formData.satisfactoryCertificateFile);
        uploadData.append('OwnerType', `${indent.indentType}Indent`);
        uploadData.append('OwnerId', indent.id);
        uploadData.append('Kind', 'SatisfactoryCertificate');
        const docId = await uploadDocument(uploadData);
        satisfactoryCertificateFileUrl = `/api/documents/${docId}/download`;
      }

      const payload = {
        billNo: formData.billNo.trim(),
        billAmount: amountNum,
        generationDate: formData.generationDate,
        itemReceivingDate: formData.itemReceivingDate,
        billProcessStatus: indent?.billProcessStatus || 'Submitted',
        billFileUrl,
        eWayBillFileUrl,
        satisfactoryCertificateFileUrl,
        originalBillReference: formData.billNo.trim() || formData.originalBillReference.trim(),
        stockEntryConfirmed: formData.stockEntryConfirmed,
        eWayBillNumber: isProductType && formData.eWayBillNumber ? formData.eWayBillNumber.trim() : null,
        measurementBookNumber: formData.measurementBookNumber ? formData.measurementBookNumber.trim() : null,
        stockBookPage: formData.stockBookPage ? formData.stockBookPage.trim() : null,
        stockDescription: formData.stockDescription ? formData.stockDescription.trim() : null,
        stockQuantity: formData.stockQuantity ? formData.stockQuantity.trim() : null,
        stockActualCost: formData.stockActualCost ? formData.stockActualCost.trim() : null,
        stockCondition: formData.stockCondition ? formData.stockCondition.trim() : null,
        miscellaneousExpenditure: formData.miscellaneousExpenditure ? parseFloat(formData.miscellaneousExpenditure) : null,
        purchaseOrderNumber: formData.purchaseOrderNumber ? formData.purchaseOrderNumber.trim() : null,
        purchaseOrderDate: formData.purchaseOrderDate || null,
        bindingLocation: formData.bindingLocation || 'Prayagraj',
        comparativeStatementNumber: formData.comparativeStatementNumber ? formData.comparativeStatementNumber.trim() : null,
        comparativeStatementSigned: formData.comparativeStatementSigned,
        eWayBillPartA: formData.eWayBillPartA ? formData.eWayBillPartA.trim() : null,
        eWayBillPartB: formData.eWayBillPartB ? formData.eWayBillPartB.trim() : null,
      };

      await processBill(indent.indentType, indent.id, payload);

      await fetchData();
    } catch (err) {
      console.error('Error processing bill:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to process bill.';
      setError(errMsg);
      if (err.problemDetails?.errors) {
        const backendList = Object.values(err.problemDetails.errors).flat().filter(Boolean);
        if (backendList.length > 0) {
          setMissingFieldsList(backendList);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignGeMMember = async (memberUserId, memberFullName) => {
    if (!indent || !memberUserId) return;
    try {
      setSubmitting(true);
      setError(null);
      const updatedStatus = `AssignedTo:${memberUserId}:${memberFullName}`;
      const amountNum = parseFloat(formData.billAmount || indent.billAmount || 0);
      const payload = {
        billNo: (formData.billNo || indent.billNo || indent.originalBillReference || 'BILL-001').trim(),
        billAmount: amountNum > 0 ? amountNum : 1000,
        generationDate: formData.generationDate || indent.generationDate || todayDateStr,
        itemReceivingDate: formData.itemReceivingDate || indent.itemReceivingDate || todayDateStr,
        originalBillReference: (formData.billNo || indent.originalBillReference || 'BILL-001').trim(),
        billProcessStatus: updatedStatus,
        billFileUrl: typeof formData.billFile === 'string' ? formData.billFile : indent.billFileUrl,
        eWayBillFileUrl: typeof formData.eWayBillFile === 'string' ? formData.eWayBillFile : indent.eWayBillFileUrl,
        satisfactoryCertificateFileUrl: typeof formData.satisfactoryCertificateFile === 'string' ? formData.satisfactoryCertificateFile : indent.satisfactoryCertificateFileUrl,
        stockEntryConfirmed: formData.stockEntryConfirmed,
        eWayBillNumber: isProductType && formData.eWayBillNumber ? formData.eWayBillNumber.trim() : indent.eWayBillNumber,
        measurementBookNumber: formData.measurementBookNumber ? formData.measurementBookNumber.trim() : indent.measurementBookNumber,
        stockBookPage: formData.stockBookPage ? formData.stockBookPage.trim() : indent.stockBookPage,
        stockDescription: formData.stockDescription ? formData.stockDescription.trim() : indent.stockDescription,
        stockQuantity: formData.stockQuantity ? formData.stockQuantity.trim() : indent.stockQuantity,
        stockActualCost: formData.stockActualCost ? formData.stockActualCost.trim() : indent.stockActualCost,
        stockCondition: formData.stockCondition ? formData.stockCondition.trim() : indent.stockCondition,
        miscellaneousExpenditure: formData.miscellaneousExpenditure ? parseFloat(formData.miscellaneousExpenditure) : indent.miscellaneousExpenditure,
        purchaseOrderNumber: formData.purchaseOrderNumber ? formData.purchaseOrderNumber.trim() : indent.purchaseOrderNumber,
        purchaseOrderDate: formData.purchaseOrderDate || indent.purchaseOrderDate,
        bindingLocation: formData.bindingLocation || indent.bindingLocation || 'Prayagraj',
        comparativeStatementNumber: formData.comparativeStatementNumber ? formData.comparativeStatementNumber.trim() : indent.comparativeStatementNumber,
        comparativeStatementSigned: formData.comparativeStatementSigned,
      };
      await processBill(indent.indentType, indent.id, payload);
      await fetchData();
    } catch (err) {
      console.error('Error assigning GeM member:', err);
      setError(err.response?.data?.message || err.message || 'Failed to assign member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForwardToPI = async (e) => {
    if (e) e.preventDefault();
    if (!indent) return;

    setError(null);
    setMissingFieldsList([]);
    const missing = [];

    if (!formData.stockBookPage || !formData.stockBookPage.trim()) {
      missing.push('Stock Book Page No. and Date is required');
    }
    if (!formData.stockDescription || !formData.stockDescription.trim()) {
      missing.push('Stock Description is required');
    }
    if (!formData.stockQuantity || !formData.stockQuantity.trim()) {
      missing.push('Stock Quantity is required');
    }
    if (!formData.stockActualCost || !formData.stockActualCost.trim()) {
      missing.push('Stock Actual Cost is required');
    }
    if (!formData.stockCondition || !formData.stockCondition.trim()) {
      missing.push('Stock Condition is required');
    }
    if (formData.stockCondition === 'Satisfactory' && !formData.satisfactoryCertificateFile && !indent?.satisfactoryCertificateFileUrl) {
      missing.push('Satisfactory Certificate file upload is required when Condition is Satisfactory');
    }
    if (missing.length > 0) {
      setMissingFieldsList(missing);
      setError('Please fill in all mandatory Stock Register Entry fields before forwarding to PI:');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSubmitting(true);
      let satisfactoryCertificateFileUrl = typeof formData.satisfactoryCertificateFile === 'string' ? formData.satisfactoryCertificateFile : null;
      if (formData.satisfactoryCertificateFile instanceof File) {
        const uploadData = new FormData();
        uploadData.append('File', formData.satisfactoryCertificateFile);
        uploadData.append('OwnerType', `${indent.indentType}Indent`);
        uploadData.append('OwnerId', indent.id);
        uploadData.append('Kind', 'SatisfactoryCertificate');
        const docId = await uploadDocument(uploadData);
        satisfactoryCertificateFileUrl = `/api/documents/${docId}/download`;
      }

      const amountNum = parseFloat(formData.billAmount || indent.billAmount || 0);
      const payload = {
        billNo: (formData.billNo || indent.billNo || indent.originalBillReference || 'BILL-001').trim(),
        billAmount: amountNum > 0 ? amountNum : 1000,
        generationDate: formData.generationDate || indent.generationDate || todayDateStr,
        itemReceivingDate: formData.itemReceivingDate || indent.itemReceivingDate || todayDateStr,
        originalBillReference: (formData.billNo || indent.originalBillReference || 'BILL-001').trim(),
        billProcessStatus: 'ForwardedToPI',
        billFileUrl: typeof formData.billFile === 'string' ? formData.billFile : indent.billFileUrl,
        eWayBillFileUrl: typeof formData.eWayBillFile === 'string' ? formData.eWayBillFile : indent.eWayBillFileUrl,
        satisfactoryCertificateFileUrl: satisfactoryCertificateFileUrl || indent.satisfactoryCertificateFileUrl,
        stockEntryConfirmed: formData.stockEntryConfirmed,
        eWayBillNumber: isProductType && formData.eWayBillNumber ? formData.eWayBillNumber.trim() : indent.eWayBillNumber,
        measurementBookNumber: formData.measurementBookNumber ? formData.measurementBookNumber.trim() : indent.measurementBookNumber,
        stockBookPage: formData.stockBookPage ? formData.stockBookPage.trim() : null,
        stockDescription: formData.stockDescription ? formData.stockDescription.trim() : null,
        stockQuantity: formData.stockQuantity ? formData.stockQuantity.trim() : null,
        stockActualCost: formData.stockActualCost ? formData.stockActualCost.trim() : null,
        stockCondition: formData.stockCondition ? formData.stockCondition.trim() : null,
        miscellaneousExpenditure: formData.miscellaneousExpenditure ? parseFloat(formData.miscellaneousExpenditure) : null,
        purchaseOrderNumber: formData.purchaseOrderNumber ? formData.purchaseOrderNumber.trim() : null,
        purchaseOrderDate: formData.purchaseOrderDate || null,
        bindingLocation: formData.bindingLocation || 'Prayagraj',
        comparativeStatementNumber: formData.comparativeStatementNumber ? formData.comparativeStatementNumber.trim() : null,
        comparativeStatementSigned: formData.comparativeStatementSigned,
        eWayBillPartA: formData.eWayBillPartA ? formData.eWayBillPartA.trim() : null,
        eWayBillPartB: formData.eWayBillPartB ? formData.eWayBillPartB.trim() : null,
      };

      await processBill(indent.indentType, indent.id, payload);
      await fetchData();
    } catch (err) {
      console.error('Error forwarding stock entry to PI:', err);
      setError(err.response?.data?.message || err.message || 'Failed to forward to PI.');
    } finally {
      setSubmitting(false);
    }
  };

  // Alias for backward compatibility
  const handleForwardGeMToPI = handleForwardToPI;

  const handleCreateNotingRedirect = () => {
    if (hasNoting || !indent) return;
    const pId = indent.projectId || projectDetails?.id || '';
    const pTitle = projectDetails?.projectTitle || projectDetails?.title || indent.projectName || '';
    const pNo = projectDetails?.projectNo || projectDetails?.sanctionNo || '';
    const sDate = projectDetails?.sanctionDate || projectDetails?.sanctionedDate || projectDetails?.startDate || projectDetails?.start_date || '';
    const agency = projectDetails?.agency || projectDetails?.fundedAgency || projectDetails?.fundingAgency || '';

    // Extract actual Indent Number from indent record
    const actualIndentNo = indent.indentNumber || indent.indentNo || indent.indent_number || indent.number || formData.billNo || indent.billNo || indent.originalBillReference || '';

    // Extract actual Indent Date from indent record
    const rawIndentDate = indent.createdAt || indent.created_at || indent.indentDate || indent.date || indent.generationDate || formData.generationDate || '';
    const formattedIndentDate = rawIndentDate ? (String(rawIndentDate).includes('T') ? String(rawIndentDate).split('T')[0] : String(rawIndentDate).split(' ')[0]) : '';

    // Format display date for Indent No & Date (e.g., 19/09/2026 or 19-09-2026)
    let displayDateStr = '';
    if (formattedIndentDate) {
      if (formattedIndentDate.includes('-') && formattedIndentDate.split('-')[0].length === 4) {
        const [yyyy, mm, dd] = formattedIndentDate.split('-');
        displayDateStr = `${dd}/${mm}/${yyyy}`;
      } else {
        displayDateStr = formattedIndentDate;
      }
    }

    const fullIndentNoAndDate = actualIndentNo ? (displayDateStr ? `${actualIndentNo}dt ${displayDateStr}` : actualIndentNo) : '';

    // Calculate Budget Head & Balance string (e.g. Non-Recurring Rs. 48,000,000/- or Contingency Rs. 1,00,000/-)
    let headTitle = 'Non-Recurring';
    const rawIndentType = (indent.indentType || '').toLowerCase();
    if (rawIndentType === 'consumable') {
      headTitle = 'Consumable';
    } else if (rawIndentType === 'contingency') {
      headTitle = 'Contingency';
    } else if (rawIndentType === 'equipment') {
      headTitle = 'Non-Recurring';
    }

    const matchingHead = projectDetails?.budgetHeads?.find(
      h => String(h.id) === String(indent.budgetHeadId)
    );
    if (matchingHead) {
      if (matchingHead.customLabel) {
        headTitle = matchingHead.customLabel;
      } else if (matchingHead.headName) {
        const rawHead = String(matchingHead.headName);
        if (rawHead.includes('Equipment') || rawHead.includes('NonRecurring')) headTitle = 'Non-Recurring';
        else if (rawHead.includes('Consumable')) headTitle = 'Consumable';
        else if (rawHead.includes('Contingency')) headTitle = 'Contingency';
        else headTitle = rawHead.replace('Recurring', '').trim();
      }
    }

    let availAmt = budgetSnapshot?.available ?? budgetSnapshot?.sanctioned ?? matchingHead?.total ?? projectDetails?.totalSanctioned ?? 0;
    let budgetHeadAndBalanceStr = headTitle;
    if (availAmt > 0) {
      budgetHeadAndBalanceStr += ` Rs. ${Number(availAmt).toLocaleString('en-IN')}/-`;
    } else if (indent.estimatedCost) {
      budgetHeadAndBalanceStr += ` Rs. ${Number(indent.estimatedCost).toLocaleString('en-IN')}/-`;
    }

    // Extract items from indent items table
    let indentItemsList = null;
    let itemDesc = '';

    if (indent.items && Array.isArray(indent.items) && indent.items.length > 0) {
      indentItemsList = indent.items.map(item => ({
        name: item.name || item.nameOfItem || item.itemDescription || item.description || '',
        estimatedCostInclTax: item.estimatedCostInclTax || item.estimatedCost || item.amount || 0,
        quantity: item.quantity || 1,
        budgetHeadAndBalance: budgetHeadAndBalanceStr
      }));
      itemDesc = indentItemsList.map(i => i.name).filter(Boolean).join(', ');
    }
    if (!itemDesc) {
      itemDesc = indent.name || indent.itemName || indent.equipmentName || indent.item_name || indent.purpose || formData.stockDescription || indent.stockDescription || '';
    }

    const indentAmt = formData.billAmount || indent.billAmount || indent.estimatedCost || indent.totalAmount || 0;
    const rawMode = isGemAvailable ? 'GeM' : 'Non-GeM';
    const modeOfPurchase = getModeOfPurchaseText(rawMode, indentAmt);

    const queryParams = new URLSearchParams();
    if (pId) queryParams.set('projectId', pId);
    if (pTitle) queryParams.set('projectTitle', pTitle);
    if (pNo) queryParams.set('projectNo', pNo);
    if (sDate) queryParams.set('sanctionDate', String(sDate).includes('T') ? String(sDate).split('T')[0] : String(sDate));
    if (agency) queryParams.set('fundedAgency', agency);
    if (actualIndentNo) queryParams.set('indentNo', actualIndentNo);
    if (formattedIndentDate) queryParams.set('indentDate', formattedIndentDate);
    if (formattedIndentDate) queryParams.set('date', formattedIndentDate);
    if (fullIndentNoAndDate) queryParams.set('indentNoAndDate', fullIndentNoAndDate);
    if (indentAmt) queryParams.set('indentAmount', String(indentAmt));
    if (itemDesc) queryParams.set('nameOfItem', itemDesc);
    if (budgetHeadAndBalanceStr) queryParams.set('budgetHeadAndBalance', budgetHeadAndBalanceStr);
    queryParams.set('modeOfPurchase', modeOfPurchase);

    navigate(`/noting-page?${queryParams.toString()}`, {
      state: {
        projectId: pId,
        projectTitle: pTitle,
        projectNo: pNo,
        sanctionDate: sDate,
        fundedAgency: agency,
        indentNo: actualIndentNo,
        indentDate: formattedIndentDate,
        date: formattedIndentDate,
        indentNoAndDate: fullIndentNoAndDate,
        indentAmount: indentAmt,
        nameOfItem: itemDesc,
        budgetHeadAndBalance: budgetHeadAndBalanceStr,
        modeOfPurchase: modeOfPurchase,
        indentItems: indentItemsList
      }
    });
  };

  const handleCreateVoucherRedirect = (e) => {
    if (e) e.preventDefault();
    if (hasPaymentVoucher || !indent) return;
    const pId = indent.projectId || indent.project_id || indent.ProjectId || projectDetails?.id || '';
    const pTitle = projectDetails?.projectTitle || projectDetails?.title || indent.projectName || '';
    const pNo = projectDetails?.projectNo || projectDetails?.sanctionNo || '';
    const sDate = projectDetails?.sanctionDate || projectDetails?.sanctionedDate || projectDetails?.startDate || projectDetails?.start_date || '';
    const agency = projectDetails?.agency || projectDetails?.fundedAgency || projectDetails?.fundingAgency || '';
    const modeOfPurchase = isGemAvailable ? 'GeM' : 'Non-GeM';
    const billNo = formData.billNo || indent.billNo || indent.originalBillReference || indent.name || '';
    const billAmt = formData.billAmount || indent.billAmount || indent.estimatedCost || 0;
    const itemDesc = formData.stockDescription || indent.stockDescription || indent.name || '';

    const queryParams = new URLSearchParams();
    if (pId) queryParams.set('projectId', pId);
    if (indent.id) queryParams.set('indentId', indent.id);
    if (indent.indentType) queryParams.set('indentType', indent.indentType);
    if (pTitle) queryParams.set('projectTitle', pTitle);
    if (pNo) queryParams.set('projectNo', pNo);
    if (sDate) queryParams.set('sanctionDate', String(sDate).includes('T') ? String(sDate).split('T')[0] : String(sDate));
    if (agency) queryParams.set('fundedAgency', agency);
    if (billNo) queryParams.set('billNo', billNo);
    if (billAmt) queryParams.set('billAmount', String(billAmt));
    if (itemDesc) queryParams.set('itemDescription', itemDesc);
    queryParams.set('modeOfPurchase', modeOfPurchase);

    navigate(`/payment-voucher?${queryParams.toString()}`, {
      state: {
        projectId: pId,
        projectTitle: pTitle,
        projectNo: pNo,
        sanctionDate: sDate,
        fundedAgency: agency,
        indentId: indent.id,
        indentType: indent.indentType,
        billNo: billNo,
        billAmount: billAmt,
        itemDescription: itemDesc,
        modeOfPurchase: modeOfPurchase
      }
    });
  };

  const handleAction = async (action, extraPayload = {}) => {
    if (!billWorkflow || actionSubmitting) return;
    try {
      setActionSubmitting(true);
      setError(null);
      setMissingFieldsList([]);
      await actionWorkflow(billWorkflow.id, action, { remarks: remarks || null, ...extraPayload });
      setRemarks('');
      await fetchData();
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
      setError(err.response?.data?.message || err.message || `Failed to execute ${action}.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 w-full text-center text-slate-500 text-sm">
        Loading indent bill details...
      </div>
    );
  }

  if (error && !indent) {
    return (
      <div className="p-6 w-full space-y-4">
        <button
          onClick={() => navigate('/process-bill')}
          className="text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center gap-1 hover:underline"
        >
          ← Back to Process Bill List
        </button>
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  const currentStage = billWorkflow?.currentStage ?? null;
  const isDraftOrRaised = !billWorkflow || currentStage === 'Raised' || currentStage === 'Draft';
  const isWithHOD = currentStage === 'WithHOD';
  const isAssignedOrOffice = currentStage === 'AssignedToDealingAssistant' || currentStage === 'WithRnCOffice';
  const isWithOSRC = currentStage === 'WithSuperintendent';
  const isWithDyRegRnC = currentStage === 'WithDeputyRegistrar';
  const isWithDean = currentStage === 'WithDean';
  const isApproved = currentStage === 'Approved';
  const isReturnedToPI = currentStage === 'ReturnedToPI';
  const isRejected = currentStage === 'Rejected';

  const isDeanApproved = isApproved;
  const isBillRaised = Boolean(
    isApproved ||
    (billWorkflow && currentStage && !['Draft', 'ReturnedToPI'].includes(currentStage)) ||
    (indent && indent.billProcessStatus)
  );

  const userRoles = user?.roles || [];
  const isHODUser = userRoles.some(r => ['HOD', 'HeadOfDepartment', 'SuperAdmin', 'Admin'].includes(r));
  const isOSRCUser = userRoles.some(r => ['Superintendent', 'SuperAdmin', 'Admin'].includes(r));
  const isOfficeUser = userRoles.some(r => ['RegularStaff', 'DealingAssistant', 'Superintendent', 'SuperAdmin', 'Admin'].includes(r));
  const isDyRegUser = userRoles.some(r => ['DeputyRegistrar', 'SuperAdmin', 'Admin'].includes(r));
  const isDeanUser = userRoles.some(r => ['Dean', 'SuperAdmin', 'Admin'].includes(r));
  const currentUserId = user?.userId ? user.userId.toLowerCase() : '';

  // Post-Approval Workflow State Handling (for both GeM and Non-GeM)
  const billProcessStatus = indent?.billProcessStatus || 'Submitted';

  // GeM Post-Approval Workflow
  const isGemPostApprovalWithOSRC = isApproved && isGemAvailable && (billProcessStatus === 'Submitted' || billProcessStatus === 'WithOSRC' || !billProcessStatus);
  const isGemPostApprovalAssigned = isApproved && isGemAvailable && billProcessStatus.startsWith('AssignedTo:');
  const isGemPostApprovalForwardedToPI = isApproved && isGemAvailable && billProcessStatus === 'ForwardedToPI';

  // Non-GeM Post-Approval Workflow (same as GeM)
  const isNonGemPostApprovalWithOSRC = isApproved && !isGemAvailable && (billProcessStatus === 'Submitted' || billProcessStatus === 'WithOSRC' || !billProcessStatus);
  const isNonGemPostApprovalAssigned = isApproved && !isGemAvailable && billProcessStatus.startsWith('AssignedTo:');
  const isNonGemPostApprovalForwardedToPI = isApproved && !isGemAvailable && billProcessStatus === 'ForwardedToPI';

  let assignedGeMMemberUserId = null;
  let assignedGeMMemberFullName = '';
  if (isGemPostApprovalAssigned || isNonGemPostApprovalAssigned) {
    const parts = billProcessStatus.split(':');
    assignedGeMMemberUserId = parts[1] ? parts[1].toLowerCase() : null;
    assignedGeMMemberFullName = parts[2] || 'Assigned Staff Member';
  }

  const isAssignedGeMMemberActor = assignedGeMMemberUserId ? (currentUserId === assignedGeMMemberUserId || isOSRCUser) : isOSRCUser;

  // Can edit PO Details & Stock Register Entry:
  // For GeM: only when bill is approved AND assigned to member (or OSRC) AND NOT yet forwarded to PI.
  // For Non-GeM: same logic - assigned to member (or OSRC) AND NOT yet forwarded to PI.
  const canEditPOAndStock = isApproved &&
    (
      (isGemAvailable && !isGemPostApprovalForwardedToPI && (
        (isGemPostApprovalAssigned && isAssignedGeMMemberActor) ||
        (isGemPostApprovalWithOSRC && isOSRCUser)
      )) ||
      (!isGemAvailable && !isNonGemPostApprovalForwardedToPI && (
        (isNonGemPostApprovalAssigned && isAssignedGeMMemberActor) ||
        (isNonGemPostApprovalWithOSRC && isOSRCUser)
      ))
    );

  const isFormFieldsDisabled = isBillRaised && !canEditPOAndStock;

  const isClerkOnly = userRoles.includes('RegularStaff') && !userRoles.some(r => ['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin'].includes(r));
  const isAssignedToOtherClerk =
    (currentStage === 'AssignedToDealingAssistant' || currentStage === 'Assigned') &&
    billWorkflow?.assignedToUserId &&
    user?.userId &&
    billWorkflow.assignedToUserId.toLowerCase() !== user.userId.toLowerCase() &&
    isClerkOnly;

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header & Navigation */}
      <div>
        <button
          onClick={() => navigate('/process-bill')}
          className="text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1.5 hover:underline mb-2.5"
        >
          ← Back to Process Bill List
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Process Bill Entry
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Fill in the required bill details, dates, file uploads, and stock references for this indent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3.5 py-1.5 bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 rounded-full text-xs font-bold shrink-0">
              Category: {indent?.indentType || 'Consumable'}
            </span>
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold border shrink-0 ${isProductType
              ? 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/80'
              : 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80'
              }`}>
              Item Type: {isProductType ? 'Product' : 'Service'}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned To Another Clerk Alert Banner */}
      {isAssignedToOtherClerk && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-amber-900 dark:text-amber-200 text-sm shadow-sm flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>This bill is currently assigned to another clerk. Only the assigned clerk can process or forward it.</span>
          </div>
        </div>
      )}

      {/* Indent Not Approved Warning Banner */}
      {indent && indent.currentStage !== 'Approved' && indent.currentStage !== 'IndentApproved' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-amber-900 dark:text-amber-200 text-sm shadow-sm flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>Please first Approve the indent the bill process will be start (Current Indent Stage: <strong>{indent.currentStage || 'Draft'}</strong>).</span>
          </div>
        </div>
      )}

      {/* Detailed Validation & Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 text-sm shadow-sm flex items-start justify-between">
          <div className="space-y-1.5 flex-1">
            <div className="font-bold text-sm flex items-center gap-2 text-rose-800 dark:text-rose-300">
              <span className="text-lg">⚠️</span> {error}
            </div>
            {missingFieldsList.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-xs font-semibold text-rose-700 dark:text-rose-300 pl-2">
                {missingFieldsList.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => { setError(null); setMissingFieldsList([]); }} className="text-rose-500 hover:text-rose-700 font-bold ml-4 text-base">✕</button>
        </div>
      )}

      {/* Indent Overview Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{indent?.name || 'Indent Details'}</h2>
        <div className="grid grid-cols-1 md:grid-cols- sm:grid-cols-5 gap-6 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-400 block font-medium mb-1">Estimated Cost</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
              ₹{estimatedCostNum.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-400 block font-medium mb-1">Item Type</span>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${isProductType
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
              {isProductType ? 'Product' : 'Service'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-400 block font-medium mb-1">GeM Availability</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{indent?.gemAvailability || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-400 block font-medium mb-1">Indent Stage</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {indent?.currentStage || 'Approved'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-400 block font-medium mb-1">Billing Status</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 capitalize">
              {currentStage || 'Not Processed'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout: Left Form Column (70%) + Right Sidebar Column (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Main Form Column (lg:col-span-8) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-6 text-xs">
            {/* SECTION 1: BILL DETAILS */}
            <div className="bg-slate-50/70 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                  BILL INFORMATION (MANDATORY FIELDS)
                </h3>
                {isBillRaised ? (
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                    🔒 Bill Submitted (Read-Only)
                  </span>
                ) : (
                  <span className="text-xs text-rose-500 font-semibold">* Required</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bill No./Invoice No./Tax Invoice No. *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isBillRaised}
                    value={formData.billNo}
                    onChange={(e) => setFormData({
                      ...formData,
                      billNo: e.target.value,
                      originalBillReference: e.target.value
                    })}
                    placeholder="e.g. BILL/2026/001"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.includes('Bill No'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.includes('Bill No')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Bill No./Invoice No./Tax Invoice No. is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    disabled={isBillRaised}
                    value={formData.billAmount}
                    onChange={(e) => setFormData({ ...formData, billAmount: e.target.value })}
                    placeholder="Enter bill amount in ₹"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${isBillAmountExceeded || missingFieldsList.some(m => m.includes('Bill Amount'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500 text-rose-900 dark:text-rose-100'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {isBillAmountExceeded && (
                    <p className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] mt-1 flex items-center gap-1">
                      <span>⚠️</span> Bill Amount (₹{currentBillAmountVal.toLocaleString('en-IN')}) cannot exceed ₹{maxAllowedAmount.toLocaleString('en-IN')} (Estimated Cost ₹{estimatedCostNum.toLocaleString('en-IN')} + 10% limit).
                    </p>
                  )}
                  {missingFieldsList.some(m => m.includes('Valid Bill Amount')) && !isBillAmountExceeded && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Valid Bill Amount is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isBillRaised}
                    value={formData.generationDate}
                    onChange={(e) => setFormData({ ...formData, generationDate: e.target.value })}
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.includes('Bill Date'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.includes('Bill Date')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Bill Date is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Receiving Date *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isBillRaised}
                    value={formData.itemReceivingDate}
                    onChange={(e) => setFormData({ ...formData, itemReceivingDate: e.target.value })}
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.includes('Item Receiving Date'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.includes('Item Receiving Date')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Item Receiving Date is required</p>
                  )}
                </div>
              </div>

              {/* Bill Upload File Input */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bill Upload {isBillRaised ? '' : '(Mandatory) *'}
                </label>
                <div className="flex items-center gap-3">
                  <label className={`flex-1 ${isBillRaised ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} bg-white dark:bg-slate-800 border-2 border-dashed rounded-xl p-3 flex items-center justify-between text-slate-600 dark:text-slate-300 transition ${!isBillRaised && missingFieldsList.some(m => m.toLowerCase().includes('bill upload') || m.toLowerCase().includes('bill document'))
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-blue-200 dark:border-blue-600/50 hover:border-blue-500'
                    }`}>
                    <span className="font-medium truncate text-slate-500 dark:text-slate-400">
                      {formData.billFile || indent?.billFileUrl ? getFileName(formData.billFile || indent?.billFileUrl) : (isBillRaised ? 'Uploaded Bill Document' : 'Choose Bill Document File (PDF / Image)...')}
                    </span>
                    {!isBillRaised && (
                      <span className="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl shrink-0 transition">
                        Browse File
                      </span>
                    )}
                    <input
                      type="file"
                      disabled={isBillRaised}
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setFormData({ ...formData, billFile: e.target.files[0] || null })}
                      className="hidden"
                    />
                  </label>
                  {(formData.billFile || indent?.billFileUrl) && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewFile(formData.billFile || indent?.billFileUrl, 'Bill Document')}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(formData.billFile || indent?.billFileUrl, 'Bill_Document')}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      {!isBillRaised && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, billFile: null })}
                          className="text-rose-500 hover:text-rose-700 font-bold text-xs px-2 py-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!isBillRaised && missingFieldsList.some(m => m.toLowerCase().includes('bill upload') || m.toLowerCase().includes('bill document')) && (
                  <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Bill Document File Upload is required</p>
                )}
              </div>
            </div>

            {/* SECTION 2: E-WAY BILL DETAILS (Visible ONLY for Product Indents) */}
            {isProductType && (
              <div className={`p-5 rounded-2xl border space-y-4 transition-colors ${isEWayMandatoryRule
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60'
                : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-700/80'
                }`}>
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isEWayMandatoryRule ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                    E-WAY BILL DETAILS (PRODUCT INDENT)
                  </h3>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${isEWayMandatoryRule
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                    : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                    {isEWayMandatoryRule ? 'Mandatory (> ₹50,000)' : 'Optional (≤ ₹50,000)'}
                  </span>
                </div>

                {isEWayMandatoryRule && (
                  <div className="p-3 bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-medium flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>
                      Since Bill Amount is greater than <strong>₹50,000</strong>, E-Way Bill Number and E-Way Bill File Upload are <strong>mandatory</strong>.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      E-Way Bill Number {isEWayMandatoryRule ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isEWayMandatoryRule}
                      disabled={isBillRaised}
                      value={formData.eWayBillNumber}
                      onChange={(e) => setFormData({ ...formData, eWayBillNumber: e.target.value })}
                      placeholder={isEWayMandatoryRule ? 'E-Way Bill No. (Mandatory)' : 'Optional'}
                      className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('e-way bill number'))
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                        }`}
                    />
                    {missingFieldsList.some(m => m.toLowerCase().includes('e-way bill number')) && (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ E-Way Bill Number is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      E-Way Bill File Upload {isEWayMandatoryRule ? '*' : '(Optional)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className={`flex-1 ${isBillRaised ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} bg-white dark:bg-slate-800 border border-dashed rounded-xl p-2.5 flex items-center justify-between text-slate-600 dark:text-slate-300 transition ${missingFieldsList.some(m => m.toLowerCase().includes('e-way bill file') || m.toLowerCase().includes('e-way file'))
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                        }`}>
                        <span className="font-medium truncate text-xs text-slate-500 dark:text-slate-400">
                          {formData.eWayBillFile ? getFileName(formData.eWayBillFile) : 'Choose E-Way File...'}
                        </span>
                        {!isBillRaised && (
                          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg shrink-0">
                            Browse
                          </span>
                        )}
                        <input
                          type="file"
                          disabled={isBillRaised}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setFormData({ ...formData, eWayBillFile: e.target.files[0] || null })}
                          className="hidden"
                        />
                      </label>
                      {(formData.eWayBillFile || indent?.eWayBillFileUrl) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewFile(formData.eWayBillFile || indent?.eWayBillFileUrl, 'E-Way Bill Document')}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(formData.eWayBillFile || indent?.eWayBillFileUrl, 'EWay_Bill_Document')}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          {!isBillRaised && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, eWayBillFile: null })}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs px-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {missingFieldsList.some(m => m.toLowerCase().includes('e-way bill file') || m.toLowerCase().includes('e-way file')) && (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ E-Way Bill File Upload is required</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Post-Approval Flow Banners (For both GeM and Non-GeM items) */}
            {/* GeM Post-Approval Flow Banners (Visible ONLY if GeM Availability is YES) */}
            {isGemAvailable && (
              <>
                {isApproved && isGemPostApprovalWithOSRC && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> GeM Bill Approved — Pending OSRC Member Assignment
                      </span>
                    </div>
                    {isOSRCUser ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-center pt-1">
                        <select
                          value={selectedClerkId}
                          onChange={(e) => setSelectedClerkId(e.target.value)}
                          className="flex-1 w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Staff Member to Assign...</option>
                          {clerkOptions.map((c) => (
                            <option key={c.userId || c.id} value={c.userId || c.id}>
                              {c.fullName} ({c.userName})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={submitting || !selectedClerkId}
                          onClick={() => {
                            const target = clerkOptions.find(c => (c.userId || c.id) === selectedClerkId);
                            if (target) handleAssignGeMMember(target.userId || target.id, target.fullName);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                        >
                          {submitting ? 'Assigning...' : 'Assign Member for Stock Entry'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                        This bill has been approved by Dean and sent to OSRC (Superintendent) to assign a staff member for filling Purchase Order and Stock Register Entry details.
                      </p>
                    )}
                  </div>
                )}

                {isApproved && isGemPostApprovalAssigned && (
                  isAssignedGeMMemberActor ? (
                    <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border-2 border-teal-200 dark:border-teal-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="font-bold text-teal-900 dark:text-teal-200 text-xs flex items-center gap-2">
                          <PenLine className="w-4 h-4 text-teal-600 dark:text-teal-400" /> GeM Bill Approved — Assigned Staff Member: <strong>{assignedGeMMemberFullName}</strong>
                        </div>
                        <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5 font-medium">
                          Please fill in the Purchase Order details and Stock Register Entry below, then click "Save & Forward to PI".
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleForwardToPI}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                      >
                        {submitting ? 'Forwarding...' : 'Save & Forward to PI'}
                      </button>
                    </div>
                  ) : null
                )}

                {isApproved && isGemPostApprovalForwardedToPI && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> GeM Bill — Stock Register Entry &amp; Purchase Order Details completed by R&amp;C Office Member and forwarded to PI.
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold rounded-full border border-emerald-300 dark:border-emerald-700">
                      Forwarded to PI — View Only
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Non-GeM Post-Approval Flow Banners (Visible ONLY if GeM Availability is NO) */}
            {!isGemAvailable && (
              <>
                {isApproved && isNonGemPostApprovalWithOSRC && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-200 dark:border-purple-800 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 dark:text-purple-200 text-xs flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Non-GeM Bill Approved — Pending OSRC Member Assignment
                      </span>
                    </div>
                    {isOSRCUser ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-center pt-1">
                        <select
                          value={selectedClerkId}
                          onChange={(e) => setSelectedClerkId(e.target.value)}
                          className="flex-1 w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select Staff Member to Assign...</option>
                          {clerkOptions.map((c) => (
                            <option key={c.userId || c.id} value={c.userId || c.id}>
                              {c.fullName} ({c.userName})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={submitting || !selectedClerkId}
                          onClick={() => {
                            const target = clerkOptions.find(c => (c.userId || c.id) === selectedClerkId);
                            if (target) handleAssignGeMMember(target.userId || target.id, target.fullName);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                        >
                          {submitting ? 'Assigning...' : 'Assign Member for Stock Entry'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                        This bill has been approved by Dean and sent to OSRC (Superintendent) to assign a staff member for filling Purchase Order and Stock Register Entry details.
                      </p>
                    )}
                  </div>
                )}

                {isApproved && isNonGemPostApprovalAssigned && (
                  isAssignedGeMMemberActor ? (
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-950/40 border-2 border-cyan-200 dark:border-cyan-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="font-bold text-cyan-900 dark:text-cyan-200 text-xs flex items-center gap-2">
                          <PenLine className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Non-GeM Bill Approved — Assigned Staff Member: <strong>{assignedGeMMemberFullName}</strong>
                        </div>
                        <p className="text-[11px] text-cyan-700 dark:text-cyan-300 mt-0.5 font-medium">
                          Please fill in the Purchase Order details and Stock Register Entry below, then click "Save & Forward to PI".
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleForwardToPI}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                      >
                        {submitting ? 'Forwarding...' : 'Save & Forward to PI'}
                      </button>
                    </div>
                  ) : null
                )}

                {isApproved && isNonGemPostApprovalForwardedToPI && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Non-GeM Bill — Stock Register Entry &amp; Purchase Order Details completed by R&amp;C Office Member and forwarded to PI.
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold rounded-full border border-emerald-300 dark:border-emerald-700">
                      Forwarded to PI — View Only
                    </span>
                  </div>
                )}
              </>
            )}

            {/* SECTION 3: PURCHASE ORDER (PO) & BINDING DETAILS */}
            <div className="bg-slate-50/70 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider">
                  PURCHASE ORDER (PO) &amp; BINDING DETAILS
                </h3>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  Optional Details
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Order (PO) No. (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isFormFieldsDisabled}
                    value={formData.purchaseOrderNumber}
                    onChange={(e) => setFormData({ ...formData, purchaseOrderNumber: e.target.value })}
                    placeholder="e.g. PO/2026/8821"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    PO Issuance Date (Optional)
                  </label>
                  <input
                    type="date"
                    disabled={isFormFieldsDisabled}
                    value={formData.purchaseOrderDate}
                    onChange={(e) => setFormData({ ...formData, purchaseOrderDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Binding Origin (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isFormFieldsDisabled}
                    value={formData.bindingLocation}
                    onChange={(e) => setFormData({ ...formData, bindingLocation: e.target.value })}
                    placeholder="Prayagraj"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
                <div className="md:col-span-7">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Comparative Statement Ref (₹2L-₹25L) (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isFormFieldsDisabled}
                    value={formData.comparativeStatementNumber}
                    onChange={(e) => setFormData({ ...formData, comparativeStatementNumber: e.target.value })}
                    placeholder="e.g. CS/2026/041"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-5 md:pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      disabled={isFormFieldsDisabled}
                      checked={formData.comparativeStatementSigned}
                      onChange={(e) => setFormData({ ...formData, comparativeStatementSigned: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                      All Committee Members Signed Comparative Statement
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* SEPARATE STOCK ENTRY CHECKBOX */}
            <div className="py-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  disabled={isFormFieldsDisabled}
                  checked={formData.stockEntryConfirmed}
                  onChange={(e) => setFormData({ ...formData, stockEntryConfirmed: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                  The item has been received and stock entry has been made
                </span>
              </label>
            </div>

            {/* SECTION 4: STOCK REGISTER ENTRY */}
            <div className="bg-slate-50/70 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider">
                  STOCK REGISTER ENTRY
                </h3>
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Mandatory Details (GeM &amp; Non-GeM)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Book Page No. and Date *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFormFieldsDisabled}
                    value={formData.stockBookPage}
                    onChange={(e) => setFormData({ ...formData, stockBookPage: e.target.value })}
                    placeholder="Stock Book Page No. and Date"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('stock book page'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.toLowerCase().includes('stock book page')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Stock Book Page No. and Date is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFormFieldsDisabled}
                    value={formData.stockDescription}
                    onChange={(e) => setFormData({ ...formData, stockDescription: e.target.value })}
                    placeholder="Item description"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('stock description'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.toLowerCase().includes('stock description')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Description is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFormFieldsDisabled}
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="Quantity"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('stock quantity'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.toLowerCase().includes('stock quantity')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Quantity is required</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Actual Cost (₹) as per stock book *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFormFieldsDisabled}
                    value={formData.stockActualCost}
                    onChange={(e) => setFormData({ ...formData, stockActualCost: e.target.value })}
                    placeholder="Actual Cost (₹) as per stock book"
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('stock actual cost'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  />
                  {missingFieldsList.some(m => m.toLowerCase().includes('stock actual cost')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Actual Cost is required</p>
                  )}
                </div>

                {indent?.indentType === 'Equipment' && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Measurement Book Number (Optional)
                    </label>
                    <input
                      type="text"
                      disabled={isFormFieldsDisabled}
                      value={formData.measurementBookNumber}
                      onChange={(e) => setFormData({ ...formData, measurementBookNumber: e.target.value })}
                      placeholder="e.g. MB-102"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Condition *
                  </label>
                  <select
                    required
                    disabled={isFormFieldsDisabled}
                    value={formData.stockCondition}
                    onChange={(e) => setFormData({
                      ...formData,
                      stockCondition: e.target.value,
                      satisfactoryCertificateFile: e.target.value === 'Satisfactory' ? formData.satisfactoryCertificateFile : null,
                      conditionRemarks: e.target.value === 'Not Satisfactory' ? formData.conditionRemarks : ''
                    })}
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 font-medium transition disabled:bg-slate-100 disabled:dark:bg-slate-800/60 disabled:text-slate-400 disabled:cursor-not-allowed ${missingFieldsList.some(m => m.toLowerCase().includes('stock condition'))
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                      }`}
                  >
                    <option value="">Select Condition</option>
                    <option value="Satisfactory">Satisfactory</option>
                    <option value="Not Satisfactory">Not Satisfactory</option>
                  </select>
                  {missingFieldsList.some(m => m.toLowerCase().includes('stock condition')) && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Condition is required</p>
                  )}
                </div>

                {formData.stockCondition === 'Satisfactory' && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 space-y-1.5">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Satisfactory Certificate (PDF/Image) *
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <label className={`flex-1 ${isFormFieldsDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} bg-white dark:bg-slate-800 border border-dashed rounded-xl p-2.5 flex items-center justify-between text-slate-600 dark:text-slate-300 transition ${missingFieldsList.some(m => m.toLowerCase().includes('satisfactory certificate'))
                        ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                        }`}>
                        <span className="font-medium truncate text-xs text-slate-500 dark:text-slate-400">
                          {formData.satisfactoryCertificateFile ? getFileName(formData.satisfactoryCertificateFile) : 'Choose Certificate File...'}
                        </span>

                        {!isFormFieldsDisabled && (
                          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg shrink-0">
                            Browse
                          </span>
                        )}
                        <input
                          type="file"
                          disabled={isFormFieldsDisabled}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setFormData({ ...formData, satisfactoryCertificateFile: e.target.files[0] || null })}
                          className="hidden"
                        />
                      </label>
                      {(formData.satisfactoryCertificateFile || indent?.satisfactoryCertificateFileUrl) && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewFile(formData.satisfactoryCertificateFile || indent?.satisfactoryCertificateFileUrl, 'Satisfactory Certificate')}
                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(formData.satisfactoryCertificateFile || indent?.satisfactoryCertificateFileUrl, 'Satisfactory_Certificate')}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          {canEditPOAndStock && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, satisfactoryCertificateFile: null })}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs px-2 py-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {missingFieldsList.some(m => m.toLowerCase().includes('satisfactory certificate')) && (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1">⚠️ Satisfactory Certificate file upload is required when Condition is Satisfactory</p>
                    )}
                  </div>
                )}
              </div>
            </div>


            {/* Form Actions Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              {isGemPostApprovalForwardedToPI || isNonGemPostApprovalForwardedToPI || ((isGemPostApprovalAssigned || isNonGemPostApprovalAssigned) && isAssignedGeMMemberActor) ? (
                <div className="w-full flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={hasNoting}
                    onClick={hasNoting ? undefined : handleCreateNotingRedirect}
                    title={hasNoting ? "Noting Page has already been created for this bill" : "Create Noting"}
                    className={`px-6 py-2.5 rounded-xl font-bold shadow-md transition text-xs flex items-center gap-2 ${hasNoting
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60 border border-slate-300 dark:border-slate-600"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                  >
                    <FileText className="w-4 h-4" /> {hasNoting ? "Noting Created (Disabled)" : "Create Noting"}
                  </button>
                  <button
                    type="button"
                    disabled={hasPaymentVoucher}
                    onClick={hasPaymentVoucher ? undefined : handleCreateVoucherRedirect}
                    title={hasPaymentVoucher ? "Payment Voucher has already been created for this bill" : "Create Voucher"}
                    className={`px-6 py-2.5 rounded-xl font-bold shadow-md transition text-xs flex items-center gap-2 ${hasPaymentVoucher
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60 border border-slate-300 dark:border-slate-600"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                  >
                    <CreditCard className="w-4 h-4" /> {hasPaymentVoucher ? "Voucher Created (Disabled)" : "Create Voucher"}
                  </button>
                </div>
              ) : isFormFieldsDisabled ? (
                <div className="w-full flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate('/process-bill')}
                    className="px-5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold transition text-xs shadow-xs"
                  >
                    ← Back to Process Bill List
                  </button>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-3.5 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                    🔒 Bill Submitted &amp; Locked (Read-Only)
                  </span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/process-bill')}
                    className="px-5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold transition text-xs shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (indent && indent.currentStage !== 'Approved' && indent.currentStage !== 'IndentApproved')}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition disabled:opacity-50 text-xs flex items-center gap-2"
                  >
                    {submitting ? 'Submitting...' : (indent && indent.currentStage !== 'Approved' && indent.currentStage !== 'IndentApproved') ? 'Indent Not Approved' : billWorkflow ? 'Save & Update Bill' : 'Save & Next'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Right Sidebar Column (lg:col-span-4) - Stacked Cards */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Documents Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Documents
            </h2>
            {indent && (
              <DocumentUploader
                ownerType={`${indent.indentType}Indent`}
                ownerId={indent.id}
                requestType={indent.indentType}
                phase="Bill"
                onUploaded={fetchData}
              />
            )}
          </div>

          {/* Card 2: Approval Timeline Section */}
          {billWorkflow && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Approval Timeline
              </h2>
              <ApprovalTimeline steps={billWorkflow.steps || []} />

              {/* Approved Banner */}
              {isApproved && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>This bill has been approved.</span>
                </div>
              )}

              {/* Rejected Banner */}
              {isRejected && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>This bill has been rejected.</span>
                </div>
              )}
            </div>
          )}

          {/* Card 3: Available Actions Panel */}
          {billWorkflow && !isApproved && !isRejected && (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-xs">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider">
                Available Actions<span className='text-red-500'>*</span>
              </h3>

              {/* PI / Raised Stage */}
              {(isDraftOrRaised || isReturnedToPI) && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                    <textarea
                      rows="2"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional remarks travel with the action"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={actionSubmitting}
                      onClick={() => handleAction('forward')}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                    >
                      {isReturnedToPI ? 'Resubmit & Forward' : 'Forward to HOD'}
                    </button>
                  </div>
                </>
              )}

              {/* HOD Stage */}
              {isWithHOD && (
                isHODUser ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                      <textarea
                        rows="2"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional remarks travel with the action"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('forward')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Forward
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-800 dark:text-indigo-300 text-xs font-semibold">
                    ℹ️ This bill has been forwarded to HOD for review.
                  </div>
                )
              )}

              {/* Clerk / Office Stage */}
              {isAssignedOrOffice && (
                isOfficeUser && !isAssignedToOtherClerk ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                      <textarea
                        rows="2"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional remarks travel with the action"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Assign to Regular Staff Clerk:
                        </label>
                        <div className="flex flex-col gap-2">
                          <select
                            value={selectedClerkId}
                            onChange={(e) => setSelectedClerkId(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Clerk...</option>
                            {clerkOptions.map((c) => (
                              <option key={c.userId || c.id} value={c.userId || c.id}>
                                {c.fullName} ({c.userName})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={actionSubmitting || !selectedClerkId}
                            onClick={() => handleAction('assign', { assigneeUserId: selectedClerkId })}
                            className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Assign &amp; Forward
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('forward')}
                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Forward
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-xs font-semibold">
                    ℹ️ This bill is currently being processed by the R&amp;C Office.
                  </div>
                )
              )}

              {/* OSRC & DyRegRnC Stage Options */}
              {(isWithOSRC || isWithDyRegRnC) && (
                ((isWithOSRC && isOSRCUser) || (isWithDyRegRnC && isDyRegUser)) ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                      <textarea
                        rows="2"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional remarks travel with the action"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('forward')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Forward
                      </button>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('return')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Return to PI
                      </button>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('reject')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Rejected
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-800 dark:text-purple-300 text-xs font-semibold">
                    ℹ️ This bill is currently with {isWithOSRC ? 'Superintendent (OSRC)' : 'Deputy Registrar'}.
                  </div>
                )
              )}

              {/* Dean Stage Options */}
              {isWithDean && (
                isDeanUser ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                      <textarea
                        rows="2"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional remarks travel with the action"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('approve')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('return')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Return to PI
                      </button>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => handleAction('reject')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                      >
                        Rejected
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold">
                    ℹ️ This bill is currently with Dean for approval.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Document Modal */}
      <ViewManpowerDocumentModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        documentTitle={previewDoc?.title || 'Document'}
        documentUrl={previewDoc?.url}
      />
    </div>
  );
}
