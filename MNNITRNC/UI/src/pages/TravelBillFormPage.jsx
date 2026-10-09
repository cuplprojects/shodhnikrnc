import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTravelRequest, processTravelBill } from '../api/travelApi';
import { getPaymentVouchers } from '../api/paymentVoucherApi';
import { listNotings } from '../api/notingApi';
import { processBill } from '../api/procurementApi';
import { getProject } from '../api/projectsApi';
import { getWorkflowInstance, getWorkflowInstanceByRequest, actionWorkflow, listDealingAssistantOptions } from '../api/workflowApi';
import { uploadDocument } from '../api/documentsApi';
import { useAuth } from '../auth/useAuth';
import { useAccess } from '../access/useAccess';
import ApprovalTimeline from '../components/ApprovalTimeline';
import DocumentUploader from '../components/DocumentUploader';
import ViewManpowerDocumentModal from './projects/components/ViewManpowerDocumentModal';
import { apiBlob, BASE_URL, stripBaseUrl } from '../api/apiClient';
import { TRAVELER_TYPES, TRAVEL_MODES } from '../constants/travelEnums';
import { 
  ArrowLeft, Plane, FileText, CheckCircle2, Clock, Wallet, MapPin, 
  Map, Receipt, Building2, User, CreditCard, Eye, Download, AlertTriangle, Lock, Save, XCircle, Send, PenLine, Trash2
} from 'lucide-react';

const DEFAULT_CLERKS = [
  { userId: 'harshit1', fullName: 'Harshit', userName: 'harshit1' },
  { userId: 'sadhvi1', fullName: 'Sadhvi', userName: 'sadhvi1' },
  { userId: 'ashok1', fullName: 'Ashok', userName: 'ashok1' },
  { userId: 'shyamu1', fullName: 'Shyamu', userName: 'shyamu1' },
  { userId: 'renu1', fullName: 'Renu', userName: 'renu1' },
  { userId: 'prateek1', fullName: 'Prateek', userName: 'prateek1' },
];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTravelerDisplay(request) {
  if (!request) return '—';
  const types = request.travelerTypes
    ? (Array.isArray(request.travelerTypes) ? request.travelerTypes : request.travelerTypes.split(','))
    : [request.travelerType];
  return types.map((t) => {
    if (t === 'Other' && request.otherTravelerDetails) {
      return `Other (${request.otherTravelerDetails})`;
    }
    return TRAVELER_TYPES.find((item) => item.value === t)?.label ?? t;
  }).join(', ');
}

function formatModeDisplay(request) {
  if (!request) return '—';
  const modes = request.primaryModes
    ? (Array.isArray(request.primaryModes) ? request.primaryModes : request.primaryModes.split(','))
    : [request.primaryMode];
  return modes.map((m) => {
    if (m === 'Other' && request.otherPrimaryModeDetails) {
      return `Other (${request.otherPrimaryModeDetails})`;
    }
    return TRAVEL_MODES.find((item) => item.value === m)?.label ?? m;
  }).join(', ');
}

function calculateTotalKm(legs) {
  if (!legs || legs.length === 0) return '';
  let total = 0;
  let hasValidNum = false;
  legs.forEach((leg) => {
    if (leg && leg.actualArrivalKm !== undefined && leg.actualArrivalKm !== null) {
      const valStr = String(leg.actualArrivalKm).trim();
      if (valStr !== '') {
        const match = valStr.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          const num = parseFloat(match[1]);
          if (!isNaN(num)) {
            total += num;
            hasValidNum = true;
          }
        }
      }
    }
  });
  return hasValidNum ? String(total) : '';
}

function formatTimeValue(val) {
  if (!val) return '';
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  if (/^\d{1}:\d{2}$/.test(val)) return `0${val}`;
  const match12 = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return val;
}

export default function TravelBillFormPage() {
  const { indentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pages } = useAccess();

  const hasNotingPermission = useMemo(() => {
    return (pages ?? []).some(
      (p) => p.pageKey === 'noting.page' || p.key === 'noting.page' || p.route === '/noting-page'
    );
  }, [pages]);

  const hasVoucherPermission = useMemo(() => {
    return (pages ?? []).some(
      (p) => p.pageKey === 'payment.voucher' || p.key === 'payment.voucher' || p.route === '/payment-voucher'
    );
  }, [pages]);

  const [request, setRequest] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [billWorkflow, setBillWorkflow] = useState(null);
  const [indentWorkflow, setIndentWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [actionRemarks, setActionRemarks] = useState('');
  const [clerkOptions, setClerkOptions] = useState(DEFAULT_CLERKS);
  const [selectedClerkId, setSelectedClerkId] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const todayDateStr = new Date().toISOString().split('T')[0];
  const [isSaved, setIsSaved] = useState(false);
  const [legArrivalDetails, setLegArrivalDetails] = useState([]);

  const [formData, setFormData] = useState({
    billNo: '',
    billAmount: '',
    generationDate: todayDateStr,
    kilometer: '',
    startTime: '',
    endTime: '',
    billFile: null,
    billFileUrl: '',
    originalBillReference: '',
  });

  const [vouchersList, setVouchersList] = useState([]);
  const [notingsList, setNotingsList] = useState([]);

  const hasPaymentVoucher = useMemo(() => {
    if (!Array.isArray(vouchersList) || vouchersList.length === 0) return false;
    const targetGuid = request?.id ? String(request.id).toLowerCase().trim() : '';
    const targetParamId = indentId ? String(indentId).toLowerCase().trim() : '';
    const billRefNo = (formData?.billNo || request?.billNo || request?.originalBillReference || '').toLowerCase().trim();
    const autoRef = indentId ? `tr-bill-${indentId.split('-')[0].toLowerCase()}` : '';

    return vouchersList.some(v => {
      const vIndentId = v.indentId ? String(v.indentId).toLowerCase().trim() : '';

      if (vIndentId) {
        if (targetGuid && vIndentId === targetGuid) return true;
        if (targetParamId && vIndentId === targetParamId) return true;
      }

      return (v.items || []).some(it => {
        const letterRef = String(it.letterNoDateMbNo || '').toLowerCase().trim();
        if (billRefNo && billRefNo.length >= 1) {
          if (letterRef === `bill ref: ${billRefNo}` || letterRef === billRefNo) return true;
        }
        if (autoRef && letterRef.includes(autoRef)) return true;
        return false;
      });
    });
  }, [vouchersList, indentId, request, formData.billNo]);

  const hasNoting = useMemo(() => {
    if (!Array.isArray(notingsList) || notingsList.length === 0) return false;
    const targetGuid = request?.id ? String(request.id).toLowerCase().trim() : '';
    const targetParamId = indentId ? String(indentId).toLowerCase().trim() : '';
    const billRefNo = (formData?.billNo || request?.billNo || request?.originalBillReference || '').toLowerCase().trim();
    const autoRef = indentId ? `tr-bill-${indentId.split('-')[0].toLowerCase()}` : '';

    return notingsList.some(n => {
      return (n.items || []).some(it => {
        const indentDateRef = String(it.indentNoAndDate || '').toLowerCase().trim();
        if (billRefNo && billRefNo.length >= 1 && indentDateRef.includes(billRefNo)) return true;
        if (autoRef && indentDateRef.includes(autoRef)) return true;
        if (targetParamId && targetParamId.length >= 2 && indentDateRef.includes(targetParamId)) return true;
        if (targetGuid && targetGuid.length >= 5 && indentDateRef.includes(targetGuid)) return true;
        return false;
      });
    });
  }, [notingsList, indentId, request, formData.billNo]);

  useEffect(() => {
    fetchData();
  }, [indentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      getPaymentVouchers({ pageSize: 0 }).then(vData => setVouchersList(vData?.items || (Array.isArray(vData) ? vData : []))).catch(() => {});
      listNotings({ pageSize: 0 }).then(nData => setNotingsList(nData?.items || (Array.isArray(nData) ? nData : []))).catch(() => {});

      const [travelData, billWfData] = await Promise.all([
        getTravelRequest(indentId),
        getWorkflowInstanceByRequest('Travel', indentId, 'Bill', { silent: true }).catch(() => null),
      ]);

      if (!travelData) {
        throw new Error('Travel request details could not be found.');
      }

      const formattedName = travelData.name || (travelData.place ? `Travel to ${travelData.place}${travelData.purpose ? ` (${travelData.purpose})` : ''}` : 'Travel Request');
      const expectedAmt = travelData.expectedCost || travelData.estimatedCost || 0;

      setRequest({
        ...travelData,
        name: formattedName,
        estimatedCost: expectedAmt,
        indentType: 'Travel',
      });
      setBillWorkflow(billWfData);

      // Check stored bill data in localStorage or request object
      const storedKey = `travel_bill_data_${indentId}`;
      const savedFlagKey = `travel_bill_saved_${indentId}`;
      const storedObjStr = localStorage.getItem(storedKey);
      const isLocallySaved = localStorage.getItem(savedFlagKey) === 'true';

      let storedObj = {};
      if (storedObjStr) {
        try { storedObj = JSON.parse(storedObjStr); } catch (e) { }
      }

      const hasBackendBill = Boolean(
        travelData.originalBillReference || travelData.actualCost || (billWfData && billWfData.currentStage && billWfData.currentStage !== 'Draft')
      );

      const savedState = hasBackendBill || isLocallySaved;
      setIsSaved(savedState);

      // Populate leg arrival details
      const storedLegs = storedObj.legArrivalDetails || [];
      const journeysList = travelData.journeys || [];
      const formattedLegs = journeysList.map((leg, idx) => {
        const legId = leg.legId || leg.id || `leg-${idx}`;
        const storedLeg = storedLegs.find((sl) => sl.legId === legId) || storedLegs[idx];
        return {
          legId: legId,
          from: leg.from || leg.journeyFrom,
          to: leg.to || leg.journeyTo,
          date: leg.date || leg.journeyDate,
          plannedArrivalDate: leg.arrivalDate || leg.date || leg.journeyDate,
          mode: leg.mode,
          amount: leg.amount,
          actualArrivalDate: storedLeg?.actualArrivalDate || leg.actualArrivalDate || leg.arrivalDate || leg.date || leg.journeyDate || todayDateStr,
          actualArrivalTime: storedLeg?.actualArrivalTime || leg.actualArrivalTime || '',
          actualArrivalKm: storedLeg?.actualArrivalKm || leg.actualArrivalKm || '',
        };
      });
      setLegArrivalDetails(formattedLegs);

      // Pre-fill initial form values
      const computedKmFromLegs = calculateTotalKm(formattedLegs);
      const initialBillNo = storedObj.billNo || travelData.originalBillReference || travelData.billNo || `TR-BILL-${indentId.split('-')[0].toUpperCase()}`;
      const initialBillAmt = storedObj.billAmount || (travelData.actualCost ? String(travelData.actualCost) : String(expectedAmt));
      const initialGenDate = storedObj.generationDate || travelData.generationDate || todayDateStr;
      const initialKm = storedObj.kilometer || travelData.kilometer || travelData.distanceKm || computedKmFromLegs || '';
      const initialStart = storedObj.startTime || travelData.startTime || (travelData.onwardDate ? String(travelData.onwardDate).split('T')[0] : '');
      const initialEnd = storedObj.endTime || travelData.endTime || (travelData.returnDate ? String(travelData.returnDate).split('T')[0] : '');
      const initialFileUrl = storedObj.billFileUrl || travelData.billFileUrl || travelData.billDocumentUrl || '';

      setFormData({
        billNo: initialBillNo,
        billAmount: initialBillAmt,
        generationDate: initialGenDate,
        kilometer: initialKm,
        startTime: initialStart,
        endTime: initialEnd,
        billFile: initialFileUrl || null,
        billFileUrl: initialFileUrl,
        originalBillReference: initialBillNo,
      });

      if (travelData.projectId) {
        getProject(travelData.projectId)
          .then((pData) => {
            if (pData) setProjectDetails(pData);
          })
          .catch(() => { });
      }

      // Load staff clerk options
      listDealingAssistantOptions()
        .then((options) => {
          if (options && options.length > 0) setClerkOptions(options);
        })
        .catch(() => { });
    } catch (err) {
      console.error('Failed to load travel request details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch details.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    if (isSaved) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLegDetailChange = (index, field, value) => {
    if (isSaved) return;
    setLegArrivalDetails((prev) => {
      const updatedLegs = prev.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg));
      if (field === 'actualArrivalKm') {
        const computedKm = calculateTotalKm(updatedLegs);
        setFormData((fPrev) => ({ ...fPrev, kilometer: computedKm }));
      }
      return updatedLegs;
    });
  };

  const handleFileChange = (e) => {
    if (isSaved) return;
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        billFile: file,
        billFileUrl: URL.createObjectURL(file),
      }));
    }
  };

  const handleViewFile = (fileOrUrl, title = 'Bill Document') => {
    if (!fileOrUrl) return;
    if (fileOrUrl instanceof File) {
      const objectUrl = URL.createObjectURL(fileOrUrl);
      setPreviewDoc({ title, url: objectUrl });
    } else if (typeof fileOrUrl === 'string') {
      // Passed through as-is -- ViewManpowerDocumentModal's stripBaseUrl
      // resolves either a relative "/api/documents/..." path or an already
      // absolute URL correctly.
      setPreviewDoc({ title, url: fileOrUrl });
    }
  };

  const handleDownloadFile = async (fileOrUrl, title = 'Bill Document') => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!request || isSaved || submitting) return;

    setError(null);
    setSuccessMsg(null);

    // Validation
    const missing = [];
    if (!formData.kilometer || String(formData.kilometer).trim() === '') {
      missing.push('Kilometer (KM) is required.');
    }
    if (!formData.startTime || String(formData.startTime).trim() === '') {
      missing.push('Start Date & Time is required.');
    }
    if (!formData.endTime || String(formData.endTime).trim() === '') {
      missing.push('End Date & Time is required.');
    }
    if (!formData.billFile && !formData.billFileUrl && !request.billFileUrl) {
      missing.push('Bill Document Upload File is required.');
    }

    // Validate Leg-Wise Arrival Details
    for (let i = 0; i < legArrivalDetails.length; i++) {
      const leg = legArrivalDetails[i];
      if (!leg.actualArrivalDate || String(leg.actualArrivalDate).trim() === '') {
        missing.push(`Leg ${i + 1} (${leg.from} → ${leg.to}): Actual Arrival Date is required.`);
      } else if (leg.date && leg.actualArrivalDate < leg.date) {
        missing.push(`Leg ${i + 1} (${leg.from} → ${leg.to}): Actual Arrival Date (${leg.actualArrivalDate}) cannot be earlier than Departure Date (${leg.date}).`);
      }
    }

    if (missing.length > 0) {
      setError(missing.join(' '));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSubmitting(true);
      let uploadedUrl = formData.billFileUrl;

      // Upload file if new file selected
      if (formData.billFile instanceof File) {
        const uploadData = new FormData();
        uploadData.append('File', formData.billFile);
        uploadData.append('OwnerType', 'TravelRequest');
        uploadData.append('OwnerId', request.id);
        uploadData.append('Kind', 'TravelBill');
        const docId = await uploadDocument(uploadData);
        uploadedUrl = `/api/documents/${docId}/download`;
      }

      const amountNum = parseFloat(formData.billAmount || request.expectedCost || 0);

      const processPayload = {
        originalBillReference: formData.billNo.trim(),
        actualCost: amountNum,
        taxiCost: request.taxiReimbursementOptedIn ? (request.taxiCost || 0) : null,
        kilometer: formData.kilometer,
        startTime: formData.startTime,
        endTime: formData.endTime,
        billFileUrl: uploadedUrl,
        billNo: formData.billNo.trim(),
        generationDate: formData.generationDate,
        legArrivalDetails: legArrivalDetails.map((l) => ({
          legId: l.legId,
          from: l.from,
          to: l.to,
          actualArrivalDate: l.actualArrivalDate || null,
          actualArrivalTime: l.actualArrivalTime || null,
          actualArrivalKm: l.actualArrivalKm || null,
        })),
      };

      // Call API
      try {
        await processTravelBill(request.id, processPayload);
      } catch (errApi) {
        await processBill('Travel', request.id, {
          billNo: formData.billNo.trim(),
          billAmount: amountNum,
          generationDate: formData.generationDate,
          itemReceivingDate: formData.endTime || formData.generationDate,
          originalBillReference: formData.billNo.trim(),
          billFileUrl: uploadedUrl,
          billProcessStatus: 'Submitted',
        }).catch(() => { });
      }

      // Persist state in localStorage so disabled state persists across refreshes
      const saveObj = {
        billNo: formData.billNo.trim(),
        billAmount: amountNum,
        generationDate: formData.generationDate,
        kilometer: formData.kilometer,
        startTime: formData.startTime,
        endTime: formData.endTime,
        billFileUrl: uploadedUrl,
        legArrivalDetails: legArrivalDetails,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`travel_bill_data_${request.id}`, JSON.stringify(saveObj));
      localStorage.setItem(`travel_bill_saved_${request.id}`, 'true');

      setIsSaved(true);
      setFormData((prev) => ({ ...prev, billFileUrl: uploadedUrl }));
      setSuccessMsg('Travel Bill has been successfully saved and submitted for approval! All form fields are now locked.');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Refresh travel request data & workflow
      await fetchData();
    } catch (err) {
      console.error('Error processing travel bill:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process travel bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action, extraPayload = {}) => {
    if (actionSubmitting) return;
    if (!actionRemarks || !actionRemarks.trim()) {
      setError('Remarks are required to perform this action.');
      return;
    }
    try {
      setActionSubmitting(true);
      setError(null);

      let targetWf = billWorkflow;

      // If bill workflow does not exist yet, raise it first by processing the bill
      if (!targetWf) {
        const amountNum = parseFloat(formData.billAmount || request.expectedCost || 0);
        const processPayload = {
          originalBillReference: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
          actualCost: amountNum,
          taxiCost: request.taxiReimbursementOptedIn ? (request.taxiCost || 0) : null,
          kilometer: formData.kilometer,
          startTime: formData.startTime,
          endTime: formData.endTime,
          billFileUrl: formData.billFileUrl,
          billNo: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
          generationDate: formData.generationDate,
        };
        await processTravelBill(request.id, processPayload).catch(() => {});
        targetWf = await getWorkflowInstanceByRequest('Travel', indentId, 'Bill', { silent: true }).catch(() => null);
      }

      if (targetWf) {
        await actionWorkflow(targetWf.id, action, { remarks: actionRemarks || null, ...extraPayload });
        setActionRemarks('');
        setSuccessMsg(`Travel bill ${action === 'forward' ? 'forwarded to HOD' : action} successfully!`);
      } else {
        setIsSaved(true);
        setSuccessMsg('Travel bill details saved and updated.');
      }

      await fetchData();
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
      setError(err.response?.data?.message || err.message || `Failed to execute ${action}.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleAssignMember = async (memberUserId, memberFullName) => {
    if (!request || !memberUserId) return;
    try {
      setActionSubmitting(true);
      setError(null);
      const updatedStatus = `AssignedTo:${memberUserId}:${memberFullName}`;
      const amountNum = parseFloat(formData.billAmount || request.expectedCost || 0);
      const processPayload = {
        originalBillReference: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
        actualCost: amountNum,
        taxiCost: request.taxiReimbursementOptedIn ? (request.taxiCost || 0) : null,
        kilometer: formData.kilometer,
        startTime: formData.startTime,
        endTime: formData.endTime,
        billFileUrl: formData.billFileUrl,
        billNo: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
        generationDate: formData.generationDate,
        billProcessStatus: updatedStatus,
      };
      await processTravelBill(request.id, processPayload);
      setSuccessMsg(`Travel bill assigned to staff member ${memberFullName} successfully!`);
      await fetchData();
    } catch (err) {
      console.error('Error assigning staff member:', err);
      setError(err.response?.data?.message || err.message || 'Failed to assign staff member.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleForwardToPIPostApproval = async () => {
    if (!request) return;
    try {
      setActionSubmitting(true);
      setError(null);
      const amountNum = parseFloat(formData.billAmount || request.expectedCost || 0);
      const processPayload = {
        originalBillReference: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
        actualCost: amountNum,
        taxiCost: request.taxiReimbursementOptedIn ? (request.taxiCost || 0) : null,
        kilometer: formData.kilometer,
        startTime: formData.startTime,
        endTime: formData.endTime,
        billFileUrl: formData.billFileUrl,
        billNo: (formData.billNo || `TR-BILL-${request.id.split('-')[0].toUpperCase()}`).trim(),
        generationDate: formData.generationDate,
        billProcessStatus: 'ForwardedToPI',
      };
      await processTravelBill(request.id, processPayload);
      setSuccessMsg('Travel bill details updated and forwarded to PI!');
      await fetchData();
    } catch (err) {
      console.error('Error forwarding to PI:', err);
      setError(err.response?.data?.message || err.message || 'Failed to forward to PI.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCreateNotingRedirect = () => {
    if (hasNoting || !request) return;
    const pId = request.projectId || projectDetails?.id || '';
    const pTitle = projectDetails?.projectTitle || projectDetails?.title || '';
    const pNo = projectDetails?.projectNo || projectDetails?.sanctionNo || '';
    const sDate = projectDetails?.sanctionDate || projectDetails?.startDate || '';
    const agency = projectDetails?.agency || '';

    const billNo = formData.billNo || request.originalBillReference || 'TR-BILL-001';
    const billAmt = formData.billAmount || request.actualCost || request.expectedCost || 0;
    const itemDesc = `Travel to ${request.place} (${request.purpose}) - Distance: ${formData.kilometer} KM`;

    const queryParams = new URLSearchParams();
    if (pId) queryParams.set('projectId', pId);
    if (pTitle) queryParams.set('projectTitle', pTitle);
    if (pNo) queryParams.set('projectNo', pNo);
    if (sDate) queryParams.set('sanctionDate', String(sDate).split('T')[0]);
    if (agency) queryParams.set('fundedAgency', agency);
    if (billNo) queryParams.set('indentNo', billNo);
    if (billAmt) queryParams.set('indentAmount', String(billAmt));
    if (itemDesc) queryParams.set('nameOfItem', itemDesc);
    queryParams.set('modeOfPurchase', 'Travel Reimbursement');

    navigate(`/noting-page?${queryParams.toString()}`, {
      state: {
        projectId: pId,
        projectTitle: pTitle,
        projectNo: pNo,
        sanctionDate: sDate,
        fundedAgency: agency,
        indentNo: billNo,
        indentAmount: billAmt,
        nameOfItem: itemDesc,
        modeOfPurchase: 'Travel Reimbursement',
      }
    });
  };

  const handleCreateVoucherRedirect = (e) => {
    if (e) e.preventDefault();
    if (hasPaymentVoucher || !request) return;
    const pId = request.projectId || request.project_id || request.ProjectId || projectDetails?.id || '';
    const pTitle = projectDetails?.projectTitle || projectDetails?.title || '';
    const pNo = projectDetails?.projectNo || projectDetails?.sanctionNo || '';
    const sDate = projectDetails?.sanctionDate || projectDetails?.startDate || '';
    const agency = projectDetails?.agency || '';

    const billNo = formData.billNo || request.originalBillReference || 'TR-BILL-001';
    const billAmt = formData.billAmount || request.actualCost || request.expectedCost || 0;
    const itemDesc = `Travel to ${request.place} (${request.purpose}) - Distance: ${formData.kilometer} KM`;

    const queryParams = new URLSearchParams();
    if (pId) queryParams.set('projectId', pId);
    if (request.id) queryParams.set('indentId', request.id);
    queryParams.set('indentType', 'Travel');
    if (pTitle) queryParams.set('projectTitle', pTitle);
    if (pNo) queryParams.set('projectNo', pNo);
    if (sDate) queryParams.set('sanctionDate', String(sDate).split('T')[0]);
    if (agency) queryParams.set('fundedAgency', agency);
    if (billNo) queryParams.set('billNo', billNo);
    if (billAmt) queryParams.set('billAmount', String(billAmt));
    if (itemDesc) queryParams.set('itemDescription', itemDesc);
    queryParams.set('modeOfPurchase', 'Travel Reimbursement');

    navigate(`/payment-voucher?${queryParams.toString()}`, {
      state: {
        projectId: pId,
        projectTitle: pTitle,
        projectNo: pNo,
        sanctionDate: sDate,
        fundedAgency: agency,
        indentId: request.id,
        indentType: 'Travel',
        billNo: billNo,
        billAmount: billAmt,
        itemDescription: itemDesc,
        modeOfPurchase: 'Travel Reimbursement',
      }
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
        Loading travel bill form details...
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="p-6 w-full space-y-4">
        <button
          onClick={() => navigate('/process-bill')}
          className="text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center gap-1 hover:underline"
        >
          <ArrowLeft size={14} /> Back to Process Bill List
        </button>
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // Only show Billing Workflow steps (phase: Bill), matching ProcessBillFormPage
  const steps = billWorkflow?.steps ?? [];

  const currentStage = billWorkflow?.currentStage ?? null;
  const isDraftOrRaised = !billWorkflow || currentStage === 'Raised' || currentStage === 'Draft';
  const isWithHOD = currentStage === 'WithHOD' || currentStage === 'SignedCopyUploaded' || currentStage === 'IndentWithHOD';
  const isAssignedOrOffice = currentStage === 'AssignedToDealingAssistant' || currentStage === 'Assigned' || currentStage === 'WithRnCOffice' || currentStage === 'IndentWithRnCOffice' || currentStage === 'IndentAssignedToDA';
  const isWithOSRC = currentStage === 'WithSuperintendent' || currentStage === 'Forwarded' || currentStage === 'IndentWithSuperintendent';
  const isWithDyRegRnC = currentStage === 'WithDeputyRegistrar' || currentStage === 'ForwardedOSRC' || currentStage === 'IndentWithDeputyRegistrar';
  const isWithDean = currentStage === 'WithDean' || currentStage === 'ForwardedDR' || currentStage === 'IndentWithDean';
  const isApproved = currentStage === 'Approved' || currentStage === 'IndentApproved';
  const isReturnedToPI = currentStage === 'ReturnedToPI' || currentStage === 'ReturnedByHODToPI' || currentStage === 'ReturnedByDeanToPI';
  const isRejected = currentStage === 'Rejected';

  const userRoles = user?.roles || [];
  const isHODUser = userRoles.some((r) => ['HOD', 'HeadOfDepartment', 'SuperAdmin', 'Admin'].includes(r));
  const isOSRCUser = userRoles.some((r) => ['Superintendent', 'SuperAdmin', 'Admin'].includes(r));
  const isOfficeUser = userRoles.some((r) => ['RegularStaff', 'DealingAssistant', 'Superintendent', 'SuperAdmin', 'Admin'].includes(r));
  const isDyRegUser = userRoles.some((r) => ['DeputyRegistrar', 'SuperAdmin', 'Admin'].includes(r));
  const isDeanUser = userRoles.some((r) => ['Dean', 'SuperAdmin', 'Admin'].includes(r));
  const currentUserId = user?.userId ? user.userId.toLowerCase() : '';

  const billProcessStatus = request?.billProcessStatus || 'Submitted';
  const isPostApprovalWithOSRC = isApproved && (!billProcessStatus || billProcessStatus === 'Submitted' || billProcessStatus === 'WithOSRC');
  const isPostApprovalAssigned = isApproved && billProcessStatus.startsWith('AssignedTo:');
  const isPostApprovalForwardedToPI = isApproved && billProcessStatus === 'ForwardedToPI';

  let assignedMemberUserId = null;
  let assignedMemberFullName = '';
  if (isPostApprovalAssigned) {
    const parts = billProcessStatus.split(':');
    assignedMemberUserId = parts[1] ? parts[1].toLowerCase() : null;
    assignedMemberFullName = parts[2] || 'Assigned Staff Member';
  }

  const isAssignedMemberActor = assignedMemberUserId
    ? (currentUserId === assignedMemberUserId || isOSRCUser)
    : isOSRCUser;

  const showDocumentShortcuts = isApproved && ((isPostApprovalAssigned && isAssignedMemberActor) || isPostApprovalForwardedToPI);

  return (
    <div className="p-6 w-full space-y-6 animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        onClick={() => navigate('/process-bill')}
        className="group flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back to Process Bill List
      </button>

      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Category: Travel
            </span>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Item Type: Service
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-slate-800 dark:text-white">
            <Plane className="text-blue-500 dark:text-blue-400" />
            Process Travel Bill Entry
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {request.name || (request.place ? `Travel to ${request.place}${request.purpose ? ` (${request.purpose})` : ''}` : 'Travel Request')}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-700 text-right shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Expected Travel Cost</p>
          <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            ₹{Number(request.estimatedCost || 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={18} />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Travel Overview Card (Pre-filled Data) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-blue-500" /> Pre-Filled Travel &amp; Project Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Traveler Type</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{formatTravelerDisplay(request)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Travel Dates</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {formatDate(request.onwardDate)} to {formatDate(request.returnDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Primary Travel Mode</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{formatModeDisplay(request)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Project Sanction No</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{projectDetails?.sanctionNo || 'N/A'}</span>
          </div>
        </div>

        {/* Journey Legs */}
        {request.journeys && request.journeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <MapPin size={14} className="text-indigo-500" /> Journey Itinerary ({request.journeys.length} Legs)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {request.journeys.map((leg, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{leg.from} → {leg.to}</span>
                    <span className="block text-[11px] text-slate-500">{formatDate(leg.date)} ({leg.mode})</span>
                  </div>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">₹{Number(leg.amount || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-filled Expense Breakdown (Accommodation & Other Expenses) */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wider">
            <CreditCard size={14} className="text-violet-500" /> Planned Expense Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Journey Total */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Plane size={13} className="text-blue-500" /> Journey Total
                </span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                  ₹{Number(request.journeyTotalCost || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sum of {request.journeys?.length || 0} journey leg(s)
              </p>
            </div>

            {/* Accommodation */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Building2 size={13} className="text-indigo-500" /> Accommodation
                </span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                  ₹{Number(request.accommodationCost || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={request.accommodationDetails || 'No details specified'}>
                {request.accommodationDetails || 'No details specified'}
              </p>
            </div>

            {/* Other Expenses */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Wallet size={13} className="text-purple-500" /> Other Expenses
                </span>
                <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                  ₹{Number(request.otherExpensesCost || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={request.otherExpensesDetails || 'No details specified'}>
                {request.otherExpensesDetails || 'No details specified'}
              </p>
            </div>

            {/* Taxi Reimbursement */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <MapPin size={13} className="text-amber-500" /> Taxi Reimbursement
                </span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                  {request.taxiReimbursementOptedIn ? (request.taxiCost != null ? `₹${Number(request.taxiCost).toLocaleString('en-IN')}` : 'Opted In') : 'Not Opted'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={request.taxiReimbursementOptedIn ? (request.taxiReason || 'Opted in at raise') : 'Not applicable'}>
                {request.taxiReimbursementOptedIn ? (request.taxiReason || 'Opted in at raise') : 'Not applicable'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Bill Form (Left) & Timeline/Docs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Travel Bill Entry Form (Editable / Lockable) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Post-Approval Workflow Banners */}
          {isApproved && isPostApprovalWithOSRC && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Travel Bill Approved — Pending OSRC Member Assignment
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
                    disabled={actionSubmitting || !selectedClerkId}
                    onClick={() => {
                      const target = clerkOptions.find((c) => (c.userId || c.id) === selectedClerkId);
                      if (target) handleAssignMember(target.userId || target.id, target.fullName);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0 flex items-center justify-center gap-1"
                  >
                    {actionSubmitting ? 'Assigning...' : 'Assign Member for Stock Entry'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                  This bill has been approved by Dean and sent to OSRC (Superintendent) to assign a staff member for filling Purchase Order and Stock Register Entry details.
                </p>
              )}
            </div>
          )}

          {isApproved && isPostApprovalAssigned && (
            isAssignedMemberActor ? (
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border-2 border-teal-200 dark:border-teal-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="font-bold text-teal-900 dark:text-teal-200 text-xs flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Travel Bill Approved — Assigned Staff Member: <strong>{assignedMemberFullName}</strong>
                  </div>
                  <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5 font-medium">
                    Please fill in the details below, then click "Save &amp; Forward to PI".
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionSubmitting}
                  onClick={handleForwardToPIPostApproval}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition shrink-0 flex items-center gap-1"
                >
                  {actionSubmitting ? 'Forwarding...' : 'Save & Forward to PI'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border-2 border-teal-200 dark:border-teal-800 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="font-bold text-teal-900 dark:text-teal-200 text-xs flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Travel Bill Approved — Assigned Staff Member: <strong>{assignedMemberFullName}</strong>
                </div>
              </div>
            )
          )}

          {isApproved && isPostApprovalForwardedToPI && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Travel Bill — Details completed by R&amp;C Office Member and forwarded to PI.
              </div>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold rounded-full border border-emerald-300 dark:border-emerald-700">
                Forwarded to PI — View Only
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="text-blue-600 dark:text-blue-400" size={20} />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  TRAVEL BILL INFORMATION (MANDATORY FIELDS)
                </h2>
              </div>

              {isSaved ? (
                <span className="px-3 py-1 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 rounded-full text-xs font-bold flex items-center gap-1 border border-rose-200 dark:border-rose-800">
                  <Lock size={12} /> Fields Locked / Saved
                </span>
              ) : (
                <span className="text-xs text-rose-500 font-medium">* Required fields</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bill No. */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bill No. / Reference No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="billNo"
                  value={formData.billNo}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  placeholder="e.g. TR-BILL/2026/001"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>

              {/* Bill Amount */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bill Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="billAmount"
                  value={formData.billAmount}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  placeholder="Enter bill amount in ₹"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>

              {/* Generation Date */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bill Generation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="generationDate"
                  value={formData.generationDate}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>

              {/* Kilometer */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kilometer Traveled (KM) <span className="text-rose-500">*</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal ml-1">(Aufrom legs, editable)</span>
                </label>
                <input
                  type="text"
                  name="kilometer"
                  value={formData.kilometer}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  placeholder="e.g. 610 KM"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>

              {/* Start Date & Time */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Journey Start Date &amp; Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>

              {/* End Date & Time */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Journey End Date &amp; Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  disabled={isSaved}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Leg-Wise Actual Arrival Details Section */}
            {legArrivalDetails.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={16} className="text-blue-500" /> Leg-Wise Actual Arrival Details &amp; Verification <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Preserves planned details and records actual arrival details for audit.
                  </span>
                </div>

                <div className="space-y-3">
                  {legArrivalDetails.map((leg, idx) => (
                    <div key={leg.legId || idx} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-extrabold">
                            Leg {idx + 1}
                          </span>
                          <span>{leg.from} → {leg.to}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Dep: <strong className="text-slate-700 dark:text-slate-300">{formatDate(leg.date)}</strong></span>
                          <span>Planned Arr: <strong className="text-slate-700 dark:text-slate-300">{formatDate(leg.plannedArrivalDate)}</strong></span>
                          <span>Mode: <strong className="text-slate-700 dark:text-slate-300">{leg.mode}</strong></span>
                          {leg.amount > 0 && <span className="text-blue-600 font-extrabold">₹{Number(leg.amount).toLocaleString('en-IN')}</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Actual Arrival Date */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Actual Arrival Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={leg.actualArrivalDate || ''}
                            min={leg.date || undefined}
                            onChange={(e) => handleLegDetailChange(idx, 'actualArrivalDate', e.target.value)}
                            disabled={isSaved}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Actual Arrival Time */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Actual Arrival Time
                          </label>
                          <input
                            type="time"
                            value={formatTimeValue(leg.actualArrivalTime || '')}
                            onChange={(e) => handleLegDetailChange(idx, 'actualArrivalTime', e.target.value)}
                            disabled={isSaved}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed cursor-pointer"
                          />
                        </div>

                        {/* Actual Arrival KM */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Actual Arrival KM / Distance
                          </label>
                          <input
                            type="text"
                            value={leg.actualArrivalKm || ''}
                            onChange={(e) => handleLegDetailChange(idx, 'actualArrivalKm', e.target.value)}
                            disabled={isSaved}
                            placeholder="e.g. 150 KM / Meter 2450"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bill Document Upload Field */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Bill Document Upload (PDF / Image) <span className="text-rose-500">*</span>
              </label>

              {(formData.billFile || formData.billFileUrl) ? (
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                      {formData.billFile instanceof File
                        ? formData.billFile.name
                        : (formData.billFileUrl ? (formData.billFileUrl.split('/').pop() || 'Travel_Bill_Document.pdf') : 'Travel Bill Document')}
                    </span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider shrink-0">
                      Selected
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleViewFile(formData.billFile || formData.billFileUrl, 'Travel Bill Document')}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      <Eye size={13} /> View
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadFile(formData.billFile || formData.billFileUrl, 'Travel Bill Document')}
                      className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                    >
                      <Download size={13} /> Download
                    </button>

                    {!isSaved && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            billFile: null,
                            billFileUrl: '',
                          }));
                        }}
                        className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    disabled={isSaved}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/40 dark:file:text-blue-300 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">Supported formats: PDF, PNG, JPG, JPEG</p>
                </div>
              )}
            </div>

            {/* Submit / Save Button */}
            {!isSaved && (
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {submitting ? 'Saving Travel Bill...' : 'Save & Process Travel Bill'}
                </button>
              </div>
            )}
          </form>

          {/* Workflow Shortcuts once Saved (Only for assigned member post-approval or pre-approval) */}
          {/* Workflow Shortcuts once Saved (Only for assigned member post-approval or pre-approval) */}
          {showDocumentShortcuts && (hasNotingPermission || hasVoucherPermission) && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Document Generation Shortcuts
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {hasNotingPermission && (
                  <button
                    type="button"
                    disabled={hasNoting}
                    onClick={hasNoting ? undefined : handleCreateNotingRedirect}
                    title={hasNoting ? "Noting Page has already been created for this bill" : "Create Noting Page"}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 ${
                      hasNoting
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                        : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <FileText size={14} /> {hasNoting ? "Noting Page Created (Disabled)" : "Create Noting Page"}
                  </button>
                )}
                {hasVoucherPermission && (
                  <button
                    type="button"
                    disabled={hasPaymentVoucher}
                    onClick={hasPaymentVoucher ? undefined : handleCreateVoucherRedirect}
                    title={hasPaymentVoucher ? "Payment Voucher has already been created for this bill" : "Create Payment Voucher"}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 ${
                      hasPaymentVoucher
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                        : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <CreditCard size={14} /> {hasPaymentVoucher ? "Payment Voucher Created (Disabled)" : "Create Payment Voucher"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (Timeline, Documents & Workflow Actions) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Approval Timeline */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" /> Approval Timeline
            </h2>

            <ApprovalTimeline steps={steps} />

            {/* Approved Banner */}
            {isApproved && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Travel bill has been approved.</span>
              </div>
            )}

            {/* Rejected Banner */}
            {isRejected && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Travel bill has been rejected.</span>
              </div>
            )}
          </section>

          {/* Card 2: Available Approval Actions (When Bill Workflow is Active/Unraised & Not Approved/Rejected) */}
          {(!billWorkflow || (!isApproved && !isRejected)) && (
            <section className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wider flex items-center gap-1.5">
                AVAILABLE ACTIONS
              </h3>

              {!isSaved ? (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={14} className="shrink-0" /> Bill Submission Required
                  </p>
                  <p>Please fill all mandatory travel bill fields and click <strong>"Save &amp; Process Travel Bill"</strong> to submit the bill and enable forwarding to HOD.</p>
                </div>
              ) : (
                <>
                  {/* PI / Raised Stage */}
                  {(isDraftOrRaised || isReturnedToPI) && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks <span className="text-rose-500">*</span></label>
                        <textarea
                          rows="2"
                          value={actionRemarks}
                          onChange={(e) => setActionRemarks(e.target.value)}
                          placeholder="Enter mandatory remarks for this action..."
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          disabled={actionSubmitting}
                          onClick={() => handleAction('forward')}
                          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                        >
                          {isReturnedToPI ? 'Resubmit & Forward to HOD' : 'Forward to HOD'}
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
                            value={actionRemarks}
                            onChange={(e) => setActionRemarks(e.target.value)}
                            placeholder="Optional remarks travel with the action"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('forward')}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Forward
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('return')}
                            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Return to PI
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('reject')}
                            className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Reject
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
                    isOfficeUser ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
                          <textarea
                            rows="2"
                            value={actionRemarks}
                            onChange={(e) => setActionRemarks(e.target.value)}
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

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionSubmitting}
                              onClick={() => handleAction('forward')}
                              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                            >
                              Forward
                            </button>
                            <button
                              type="button"
                              disabled={actionSubmitting}
                              onClick={() => handleAction('return')}
                              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                            >
                              Return to PI
                            </button>
                            <button
                              type="button"
                              disabled={actionSubmitting}
                              onClick={() => handleAction('reject')}
                              className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                            >
                              Reject
                            </button>
                          </div>
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
                            value={actionRemarks}
                            onChange={(e) => setActionRemarks(e.target.value)}
                            placeholder="Optional remarks travel with the action"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('forward')}
                            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Forward
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('return')}
                            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Return to PI
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('reject')}
                            className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Reject
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
                            value={actionRemarks}
                            onChange={(e) => setActionRemarks(e.target.value)}
                            placeholder="Optional remarks travel with the action"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('approve')}
                            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('return')}
                            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Return to PI
                          </button>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => handleAction('reject')}
                            className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold">
                        ℹ️ This bill is currently with Dean for approval.
                      </div>
                    )
                  )}
                </>
              )}
            </section>
          )}

          {/* Card 3: Documents Section */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" /> Request Documents
            </h2>
            <DocumentUploader
              ownerType="TravelRequest"
              ownerId={indentId}
              requestType="Travel"
              phase="Bill"
              onUploaded={() => { void fetchData(); }}
            />
          </section>
        </div>

      </div>

      {/* Document View Modal */}
      {previewDoc && (
        <ViewManpowerDocumentModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          documentUrl={previewDoc.url}
        />
      )}
    </div>
  );
}
