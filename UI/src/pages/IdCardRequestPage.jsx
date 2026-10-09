import { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle, Clock, XCircle, ShieldCheck,
  RefreshCw, Send, BookOpen, User, Building, Award,
  ArrowLeft, Download, Upload, FileText,
  Eye, Image as ImageIcon, FileSignature, Check, Plus, Edit
} from 'lucide-react';
import { getIdCardRequests, createIdCardRequest, updateIdCardRequest, processIdCardAction, getNextIdCardNumber, getCandidateProfileForIdCard } from '../api/idCardApi';
import { useAuth } from '../auth/useAuth';
import toast from 'react-hot-toast';

export default function IdCardRequestPage() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isSuperAdmin = userRoles.includes('SuperAdmin');
  const currentUserId = (user?.userId || user?.id || '').toLowerCase();

  const isCandidateUser = isSuperAdmin || userRoles.includes('Fellow') || userRoles.includes('Candidate') || (!userRoles.includes('Faculty') && !userRoles.includes('HOD') && !userRoles.includes('Dean') && !userRoles.includes('Library'));

  const isItemOwner = (item) => {
    if (!item) return false;
    if (isSuperAdmin) return true;
    if (currentUserId) {
      const studentId = (item.studentUserId || '').toLowerCase();
      const createdById = (item.createdByUserId || '').toLowerCase();
      if (studentId === currentUserId || createdById === currentUserId) return true;
    }
    return isCandidateUser && !userRoles.includes('Faculty') && !userRoles.includes('HOD') && !userRoles.includes('Dean') && !userRoles.includes('Library');
  };

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  // Navigation View: 'LIST' | 'CREATE' | 'DETAIL'
  const [viewMode, setViewMode] = useState('LIST');
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);

  // Action / Approval state
  const [remarks, setRemarks] = useState('');
  const [customCardNo, setCustomCardNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State for inline Create Page
  const [formData, setFormData] = useState({
    rollNumber: '',
    studentName: user?.fullName || user?.userName || '',
    designation: 'JRF',
    projectNumber: 'MNNIT/CSED/2026/01',
    departmentId: '08dcd37c-f232-4752-8b43-b1d5a7e11234',
    departmentName: 'Computer Science & Engineering',
    identityCode: '',
    localAddress: '',
    emergencyPhone: '',
    mobilePhone: user?.phoneNumber || '',
    email: user?.email || '',
    permAddress: '',
    permDistrict: '',
    permPin: '',
    category: '',
    categoryOther: '',
    addCategory: '',
    piName: '',
    bloodGroup: '',
    dob: '',
    dateOfJoining: '',
    periodFrom: '',
    periodTo: '',
    sex: '',
    aadharNo: '',
    appointmentLetterNo: '',
    photoUrl: '',
    signatureUrl: '',
    documentName: '',
    remarks: ''
  });

  const canUserActionStage = (status) => {
    if (isSuperAdmin) return true;
    switch (status) {
      case 'Pending Library Approval':
      case 'Pending PI Approval':
        return userRoles.includes('Faculty') || userRoles.includes('PI');
      case 'Pending HOD Approval':
        return userRoles.includes('HOD');
      case 'Pending Dean Approval':
      case 'Pending':
        return userRoles.includes('Dean');
      default:
        return false;
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getIdCardRequests();
      if (Array.isArray(data)) {
        setCards(data);
        if (selectedCard) {
          const updated = data.find(c => c.id === selectedCard.id);
          if (updated) setSelectedCard(updated);
        }
      }
    } catch (err) {
      console.warn('Backend API error or unauthenticated:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextCode = async () => {
    try {
      const res = await getNextIdCardNumber();
      const code = res?.nextCode || res;
      if (code && typeof code === 'string') {
        setFormData(prev => ({ ...prev, rollNumber: code, identityCode: code }));
      } else if (res && res.nextCode) {
        setFormData(prev => ({ ...prev, rollNumber: res.nextCode, identityCode: res.nextCode }));
      }
    } catch (err) {
      console.warn('Could not fetch next ID Card code:', err);
    }
  };

  const fetchCandidateProfile = async () => {
    try {
      const profile = await getCandidateProfileForIdCard();
      if (profile) {
        setFormData(prev => ({
          ...prev,
          studentName: profile.studentName || prev.studentName,
          mobilePhone: profile.mobilePhone || prev.mobilePhone,
          emergencyPhone: profile.emergencyPhone || prev.emergencyPhone || profile.mobilePhone || prev.mobilePhone,
          email: profile.email || prev.email,
          localAddress: profile.localAddress || prev.localAddress,
          permAddress: profile.permAddress || prev.permAddress,
          permDistrict: profile.permDistrict || prev.permDistrict,
          permPin: profile.permPin || prev.permPin,
          category: profile.category || prev.category || 'Research Fellow',
          addCategory: profile.addCategory || prev.addCategory || 'GEN',
          designation: profile.designation || prev.designation || 'JRF',
          projectNumber: profile.projectNumber || prev.projectNumber,
          departmentId: profile.departmentId || prev.departmentId,
          departmentName: profile.departmentName || prev.departmentName,
          piName: profile.piName || prev.piName,
          dob: profile.dob || prev.dob,
          dateOfJoining: profile.dateOfJoining || prev.dateOfJoining,
          periodFrom: profile.periodFrom || prev.periodFrom,
          periodTo: profile.periodTo || prev.periodTo,
          sex: profile.sex || prev.sex || 'Male',
          aadharNo: profile.aadharNo || prev.aadharNo,
          appointmentLetterNo: profile.appointmentLetterNo || prev.appointmentLetterNo,
          photoUrl: profile.photoUrl || prev.photoUrl,
          signatureUrl: profile.signatureUrl || prev.signatureUrl,
        }));
      }
    } catch (err) {
      console.warn('Could not auto-fill candidate profile:', err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (viewMode === 'CREATE') {
      fetchNextCode();
      if (!editingCardId) {
        fetchCandidateProfile();
      }
    }
  }, [viewMode, editingCardId]);

  const parseFormRemarks = (item) => {
    if (!item) return {};
    let ext = {};
    if (item.remarks) {
      try {
        if (typeof item.remarks === 'string' && item.remarks.trim().startsWith('{')) {
          ext = JSON.parse(item.remarks);
        }
      } catch (e) {
        console.warn('Could not parse JSON remarks:', e);
      }
    }
    return {
      identityCode: item.identityCode || ext.identityCode || item.rollNumber || '',
      studentName: item.studentName || ext.studentName || '',
      localAddress: item.localAddress || ext.localAddress || '',
      emergencyPhone: item.emergencyPhone || ext.emergencyPhone || '',
      mobilePhone: item.mobilePhone || ext.mobilePhone || '',
      email: item.email || ext.email || '',
      permAddress: item.permanentAddress || ext.permAddress || '',
      permDistrict: item.permanentDistrict || ext.permDistrict || '',
      permPin: item.permanentPin || ext.permPin || '',
      category: item.category || ext.category || 'Research Fellow',
      addCategory: item.additionalCategory || ext.addCategory || 'GEN',
      piName: item.piName || ext.piName || '',
      bloodGroup: item.bloodGroup || ext.bloodGroup || '',
      dob: item.dateOfBirth || ext.dob || '',
      dateOfJoining: item.dateOfJoining || ext.dateOfJoining || '',
      periodFrom: item.periodFrom || ext.periodFrom || '',
      periodTo: item.periodTo || ext.periodTo || '',
      sex: item.gender || ext.sex || 'Male',
      aadharNo: item.aadharNumber || ext.aadharNo || '',
      appointmentLetterNo: item.appointmentLetterNo || ext.appointmentLetterNo || '',
      photoUrl: item.photoUrl || ext.photoUrl || '',
      signatureUrl: item.signatureUrl || ext.signatureUrl || '',
      documentName: item.documentName || ext.documentName || '',
      userRemarks: item.remarks
    };
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [field]: reader.result,
        ...(field === 'documentUrl' ? { documentName: file.name } : {})
      }));
    };
    reader.readAsDataURL(file);
  };

  const resetFormData = () => {
    setEditingCardId(null);
    setFormData({
      rollNumber: '',
      studentName: user?.fullName || user?.userName || '',
      designation: 'JRF',
      projectNumber: 'MNNIT/CSED/2026/01',
      departmentId: '08dcd37c-f232-4752-8b43-b1d5a7e11234',
      departmentName: 'Computer Science & Engineering',
      identityCode: '',
      localAddress: '',
      emergencyPhone: '',
      mobilePhone: user?.phoneNumber || '',
      email: user?.email || '',
      permAddress: '',
      permDistrict: '',
      permPin: '',
      category: '',
      categoryOther: '',
      addCategory: '',
      piName: '',
      bloodGroup: '',
      dob: '',
      dateOfJoining: '',
      periodFrom: '',
      periodTo: '',
      sex: '',
      aadharNo: '',
      appointmentLetterNo: '',
      photoUrl: '',
      signatureUrl: '',
      documentName: '',
      remarks: ''
    });
    fetchNextCode();
  };

  const handleEdit = (item) => {
    if (!item) return;
    const ext = parseFormRemarks(item);
    setEditingCardId(item.id);
    setFormData({
      rollNumber: item.rollNumber || ext.identityCode || '',
      studentName: item.studentName || ext.studentName || user?.fullName || user?.userName || '',
      designation: item.designation || '',
      projectNumber: item.projectNumber || '',
      departmentId: item.departmentId || '',
      departmentName: item.departmentName || '',
      identityCode: item.identityCode || ext.identityCode || item.rollNumber || '',
      localAddress: item.localAddress || ext.localAddress || '',
      emergencyPhone: item.emergencyPhone || ext.emergencyPhone || '',
      mobilePhone: item.mobilePhone || ext.mobilePhone || '',
      email: item.email || ext.email || '',
      permAddress: item.permanentAddress || ext.permAddress || '',
      permDistrict: item.permanentDistrict || ext.permDistrict || '',
      permPin: item.permanentPin || ext.permPin || '',
      category: item.category || ext.category || '',
      categoryOther: '',
      addCategory: item.additionalCategory || ext.addCategory || '',
      piName: item.piName || ext.piName || '',
      bloodGroup: item.bloodGroup || ext.bloodGroup || '',
      dob: item.dateOfBirth || ext.dob || '',
      dateOfJoining: item.dateOfJoining || ext.dateOfJoining || '',
      periodFrom: item.periodFrom || ext.periodFrom || '',
      periodTo: item.periodTo || ext.periodTo || '',
      sex: item.gender || ext.sex || '',
      aadharNo: item.aadharNumber || ext.aadharNo || '',
      appointmentLetterNo: item.appointmentLetterNo || ext.appointmentLetterNo || '',
      photoUrl: item.photoUrl || ext.photoUrl || '',
      signatureUrl: item.signatureUrl || ext.signatureUrl || '',
      documentName: item.documentName || ext.documentName || '',
      remarks: item.remarks || ''
    });
    setViewMode('CREATE');
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!formData.rollNumber) {
      toast.error('Please enter Roll / Enrollment Number.');
      return;
    }
    if (!formData.studentName?.trim()) {
      toast.error('Please enter Candidate / Scholar Name.');
      return;
    }
    if (!formData.photoUrl) {
      toast.error('Please upload Candidate Photo.');
      return;
    }
    if (!formData.localAddress?.trim()) {
      toast.error('Please enter Local Address.');
      return;
    }
    if (!formData.permAddress?.trim()) {
      toast.error('Please enter Permanent Address.');
      return;
    }
    if (!formData.dob) {
      toast.error('Please select Date of Birth.');
      return;
    }
    if (!formData.dateOfJoining) {
      toast.error('Please select Date of Joining.');
      return;
    }
    if (!formData.sex) {
      toast.error('Please select Sex / Gender.');
      return;
    }
    if (!formData.signatureUrl) {
      toast.error('Please upload Candidate Signature.');
      return;
    }

    const tenDigitRegex = /^\d{10}$/;
    if (!formData.emergencyPhone || !tenDigitRegex.test(formData.emergencyPhone)) {
      toast.error('Emergency Phone No. must be an exact 10-digit numeric number.');
      return;
    }
    if (!formData.mobilePhone || !tenDigitRegex.test(formData.mobilePhone)) {
      toast.error('Personal Mobile No. must be an exact 10-digit numeric number.');
      return;
    }

    const rawAadhar = (formData.aadharNo || '').replace(/\D/g, '');
    if (!rawAadhar || rawAadhar.length !== 12) {
      toast.error('Aadhar Number must be an exact 12-digit number (e.g. 4567-2589-7415).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        designation: formData.designation,
        projectNumber: formData.projectNumber,
        departmentId: formData.departmentId,
        remarks: formData.remarks,
        localAddress: formData.localAddress,
        emergencyPhone: formData.emergencyPhone,
        mobilePhone: formData.mobilePhone,
        email: formData.email,
        permanentAddress: formData.permAddress,
        permanentDistrict: formData.permDistrict,
        permanentPin: formData.permPin,
        category: formData.category || null,
        additionalCategory: formData.addCategory || null,
        piName: formData.piName,
        bloodGroup: formData.bloodGroup || null,
        dateOfBirth: formData.dob,
        dateOfJoining: formData.dateOfJoining,
        periodFrom: formData.periodFrom,
        periodTo: formData.periodTo,
        gender: formData.sex || null,
        aadharNumber: formData.aadharNo,
        appointmentLetterNo: formData.appointmentLetterNo,
        photoUrl: formData.photoUrl,
        signatureUrl: formData.signatureUrl,
        documentName: formData.documentName
      };

      if (editingCardId) {
        await updateIdCardRequest(editingCardId, payload);
      } else {
        await createIdCardRequest({
          ...payload,
          rollNumber: formData.rollNumber,
          studentName: formData.studentName || user?.fullName || '',
          identityCode: formData.identityCode || formData.rollNumber,
        });
      }

      setViewMode('LIST');
      resetFormData();
      fetchRequests();
    } catch (err) {
      toast.error(`Failed to ${editingCardId ? 'update' : 'submit'} ID Card Request: ` + (err.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessAction = async (actionType) => {
    if (!selectedCard) return;
    setSubmitting(true);
    try {
      await processIdCardAction(selectedCard.id, actionType, remarks, customCardNo);
      setRemarks('');
      setCustomCardNo('');
      await fetchRequests();
    } catch (err) {
      toast.error('Action Failed: ' + (err.response?.data?.message || err.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTableAction = async (item, actionType) => {
    if (!item) return;
    const actionLabel = actionType === 'Approve' ? 'Forward' : 'Reject';

    setSubmitting(true);
    try {
      await processIdCardAction(item.id, actionType, `${actionLabel}ed from request queue`);
      await fetchRequests();
    } catch (err) {
      toast.error('Action Failed: ' + (err.response?.data?.message || err.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStageBadgeClass = (status) => {
    switch (status) {
      case 'Issued':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300';
      case 'Pending Library Approval':
      case 'Pending PI Approval':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300';
      case 'Pending HOD Approval':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300';
      case 'Pending Dean Approval':
      case 'Pending':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    }
  };

  const getRequiredRoleLabel = (status) => {
    switch (status) {
      case 'Pending Library Approval':
      case 'Pending PI Approval':
        return 'PI / Faculty Role Required';
      case 'Pending HOD Approval':
        return 'HOD Role Required';
      case 'Pending Dean Approval':
      case 'Pending':
        return 'Dean (R&C) Role Required';
      default:
        return 'Role Authorization';
    }
  };

  const getNextStageLabel = (status) => {
    switch (status) {
      case 'Pending Library Approval':
      case 'Pending PI Approval':
        return 'PI Approve & Forward';
      case 'Pending HOD Approval':
        return 'HOD Approve & Forward';
      case 'Pending Dean Approval':
      case 'Pending':
        return 'Dean Final Approve & Issue';
      default:
        return 'Approve Stage';
    }
  };

  const getQueueCount = (key) => {
    switch (key) {
      case 'ALL': return cards.length;
      case 'PI': return cards.filter((c) => c.status === 'Pending PI Approval' || c.status === 'Pending Library Approval').length;
      case 'HOD': return cards.filter((c) => c.status === 'Pending HOD Approval').length;
      case 'DEAN': return cards.filter((c) => c.status === 'Pending Dean Approval' || c.status === 'Pending').length;
      case 'ISSUED': return cards.filter((c) => c.status === 'Issued').length;
      case 'REJECTED': return cards.filter((c) => c.status === 'Rejected').length;
      default: return 0;
    }
  };

  const getStageStepNumber = (status) => {
    switch (status) {
      case 'Pending Library Approval':
      case 'Pending PI Approval': return 1;
      case 'Pending HOD Approval': return 2;
      case 'Pending Dean Approval':
      case 'Pending': return 3;
      case 'Issued': return 4;
      case 'Rejected': return -1;
      default: return 1;
    }
  };

  const filteredCards = cards.filter((c) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PI') return c.status === 'Pending PI Approval' || c.status === 'Pending Library Approval';
    if (activeTab === 'HOD') return c.status === 'Pending HOD Approval';
    if (activeTab === 'DEAN') return c.status === 'Pending Dean Approval' || c.status === 'Pending';
    if (activeTab === 'ISSUED') return c.status === 'Issued';
    if (activeTab === 'REJECTED') return c.status === 'Rejected';
    return true;
  });

  // Printable Form Trigger
  const handlePrintForm = (item) => {
    const ext = parseFormRemarks(item);

    const printWin = window.open('', '_blank');
    if (!printWin) return toast.success('Please allow popups to download/print the form');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Identity Card Form - ${item.studentName || 'Scholar'}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; background: #fff; }
          .container { width: 100%; max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 20px; box-sizing: border-box; position: relative; }
          .header { display: flex; align-items: center; justify-content: center; gap: 18px; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
          .header-logo { height: 75px; width: auto; object-fit: contain; flex-shrink: 0; }
          .header-text { text-align: center; }
          .header-text h3 { margin: 2px 0; font-size: 13px; text-transform: uppercase; font-weight: bold; }
          .header-text h2 { margin: 4px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .title-box { background: #333; color: #fff; text-align: center; padding: 6px; font-weight: bold; font-size: 14px; margin: 6px 0; -webkit-print-color-adjust: exact; }
          .note { font-size: 11px; margin-bottom: 8px; line-height: 1.4; }
          .row { display: flex; margin-bottom: 10px; font-size: 13px; align-items: baseline; }
          .label { font-weight: bold; width: 140px; flex-shrink: 0; }
          .value { flex-grow: 1; border-bottom: 1px dotted #000; padding-bottom: 2px; }
          .grid-boxes { display: flex; flex-wrap: wrap; gap: 3px; max-width: 100%; }
          .box { width: 18px; height: 22px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 12px; line-height: 22px; flex-shrink: 0; box-sizing: border-box; }
          .top-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; width: 100%; box-sizing: border-box; }
          .top-left { flex: 1 1 auto; min-width: 0; }
          .pho{ width: 110px; height: 130px; border: 1.5px solid #000; text-align: center; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; background: #f8fafc; font-size: 11px; font-weight: bold; margin-left: 10px; margin-top: -28px; box-sizing: border-box; }
          .phoimg { width: 100%; height: 100%; object-fit: cover; }
          .checkbox-group { display: flex; gap: 15px; }
          .checkbox { display: inline-flex; align-items: center; gap: 4px; }
          .box-check { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; text-align: center; line-height: 12px; font-size: 10px; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; font-size: 12px; }
          .sig-box { width: 200px; }
          .sig-box img { max-height: 50px; max-width: 180px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Download Form</button>
        </div>
        <div class="container">
          <div class="header">
            <img src="${window.location.origin}/images/MNNIT_LOGO.png" class="header-logo" alt="MNNIT Emblem" />
            <div class="header-text">
              <h3>केंद्रीय पुस्तकालय / CENTRAL LIBRARY</h3>
              <h2>मोतीलाल नेहरू राष्ट्रीय प्रौद्योगिकी संस्थान इलाहाबाद - प्रयागराज</h2>
              <h2>MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY ALLAHABAD - PRAYAGRAJ</h2>
            </div>
          </div>

          <div class="title-box">INSTITUTE IDENTITY CARD FORM FOR RESEARCH FELLOW UNDER PROJECT</div>
          <div style="text-align:center; font-size: 11px; margin-bottom: 10px;"><u>(Only for Identity Card)</u></div>

          <div class="note">
            <strong>NOTE :</strong> a. Fill this form in CAPITAL LETTERS (in English). Use one box for each letter and leave one box after every word.<br>
            b. It is responsibility of the Research Fellow / Project staff under Project to fill this correctly.
          </div>

          <div class="top-flex">
            <div class="top-left">
              <div class="row">
                <span class="label">1- Identity Code:</span>
                <div class="grid-boxes">
                  ${(ext.identityCode || item.rollNumber || '').padEnd(16, ' ').slice(0, 16).split('').map(ch => `<div class="box">${ch !== ' ' ? ch.toUpperCase() : '&nbsp;'}</div>`).join('')}
                </div>
              </div>

              <div class="row">
                <span class="label">2- NAME:</span>
                <div class="grid-boxes">
                  ${(ext.studentName || item.studentName || '').padEnd(20, ' ').slice(0, 20).split('').map(ch => `<div class="box">${ch !== ' ' ? ch.toUpperCase() : '&nbsp;'}</div>`).join('')}
                </div>
              </div>
            </div>

            <div class="pho">
              ${ext.photoUrl ? `<img src="${ext.photoUrl}" alt="Photo" />` : 'PHOTO'}
            </div>
          </div>

          <div class="row">
            <span class="label">3- Address (Local):</span>
            <span class="value">${ext.localAddress || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">4- Phone No. (Emergency):</span>
            <span class="value">${ext.emergencyPhone || 'N/A'} &nbsp;&nbsp;&nbsp; <strong>Mobile:</strong> ${ext.mobilePhone || 'N/A'} &nbsp;&nbsp;&nbsp; <strong>E-mail:</strong> ${ext.email || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">5- Permanent Address:</span>
            <span class="value">${ext.permAddress || 'N/A'} &nbsp;&nbsp;&nbsp;&nbsp; <strong>District:</strong> ${ext.permDistrict || 'N/A'} &nbsp;&nbsp;&nbsp;&nbsp; <strong>PIN:</strong> ${ext.permPin || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">6- Category:</span>
            <div class="checkbox-group">
              <span class="checkbox"><span class="box-check">${ext.category === 'Research Fellow' ? '✓' : ''}</span> Research Fellow</span>
              <span class="checkbox"><span class="box-check">${ext.category === 'Project Staff' ? '✓' : ''}</span> Project Staff</span>
              <span class="checkbox"><span class="box-check">${ext.category === 'Others' ? '✓' : ''}</span> Others</span>
            </div>
          </div>

          <div class="row">
            <span class="label">7- Additional Category:</span>
            <div class="checkbox-group">
              <span class="checkbox"><span class="box-check">${ext.addCategory === 'GEN' ? '✓' : ''}</span> GEN</span>
              <span class="checkbox"><span class="box-check">${ext.addCategory === 'OBC' ? '✓' : ''}</span> OBC</span>
              <span class="checkbox"><span class="box-check">${ext.addCategory === 'SC' ? '✓' : ''}</span> SC</span>
              <span class="checkbox"><span class="box-check">${ext.addCategory === 'ST' ? '✓' : ''}</span> ST</span>
            </div>
          </div>

          <div class="row">
            <span class="label">8- Designation:</span>
            <span class="value">${item.designation || 'JRF'}</span>
          </div>

          <div class="row">
            <span class="label">9- Project:</span>
            <span class="value">${item.projectNumber || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">10- Name of Project Investigator:</span>
            <span class="value">${ext.piName || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">11- Blood Group:</span>
            <span class="value">${ext.bloodGroup || 'N/A'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>12- Date of Birth:</strong> ${ext.dob || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">13- Date of Joining:</span>
            <span class="value">${ext.dateOfJoining || 'N/A'} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Period: From:</strong> ${ext.periodFrom || 'N/A'} <strong>To:</strong> ${ext.periodTo || 'N/A'}</span>
          </div>

          <div class="row">
            <span class="label">14- Sex:</span>
            <div class="checkbox-group">
              <span class="checkbox"><span class="box-check">${ext.sex === 'Male' ? '✓' : ''}</span> Male</span>
              <span class="checkbox"><span class="box-check">${ext.sex === 'Female' ? '✓' : ''}</span> Female</span>
            </div>
          </div>

          <div class="row">
            <span class="label">15- Adhar Number (UID):</span>
            <span class="value">${ext.aadharNo || 'N/A'} &nbsp;&nbsp;&nbsp;&nbsp; <strong>16- Appointment letter no:</strong> ${ext.appointmentLetterNo || 'N/A'}</span>
          </div>

          <div class="row" style="margin-top: 20px;">
            <span class="label">Recommendation of Dean (R & C):</span>
            <span class="value">${item.status === 'Issued' ? 'Approved & Recommended for Identity Card Generation' : item.status}</span>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <br><br>
              <strong>Date:</strong> ${new Date(item.createdAt).toLocaleDateString()}
            </div>
            <div class="sig-box">
              ${ext.signatureUrl ? `<img src="${ext.signatureUrl}" alt="Signature" /><br>` : '<br><br>'}
              <strong>(Signature of Research Fellow / Project staff)</strong>
            </div>
          </div>

          ${item.idCardNumber ? `
            <div style="margin-top: 25px; border-top: 1px dashed #000; padding-top: 10px; text-align: center; font-weight: bold; font-size: 13px;">
              ISSUED ID CARD NUMBER: <span style="color: #2563eb;">${item.idCardNumber}</span> &nbsp;|&nbsp; ISSUED ON: ${new Date(item.issuedAt || Date.now()).toLocaleDateString()}
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div className="max-w-[1530px] space-y-6 animate-in fade-in duration-300 px-3 sm:px-6 py-5">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <CreditCard size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Research Scholar ID Card Management
              </h1>
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs px-3 py-0.5 rounded-full font-bold">
                Sequential Workflow: PI ➔ HOD ➔ Dean
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Candidate Request Form Pipeline with role-gated approvals & official form generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRequests}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
            title="Refresh List"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {viewMode === 'LIST' ? (
            isCandidateUser && (
              <button
                onClick={() => { resetFormData(); setViewMode('CREATE'); }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus size={18} />
                Raise ID Card Request
              </button>
            )
          ) : (
            <button
              onClick={() => { setViewMode('LIST'); setSelectedCard(null); resetFormData(); }}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Requests List
            </button>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: INLINE CREATE REQUEST FORM PAGE */}
      {viewMode === 'CREATE' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">
                {editingCardId ? 'Edit Candidate Request' : 'Candidate Request Form'}
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="text-blue-600" size={24} />
                {editingCardId ? 'Edit Institute Identity Card Request' : 'Institute Identity Card Form (For Research Fellow / Project Staff)'}
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setViewMode('LIST'); resetFormData(); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Form Header Visual Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-center gap-4 text-center shadow-md">
            <img src="/images/MNNIT_LOGO.png" alt="MNNIT Logo" className="h-14 w-auto object-contain bg-white/10 p-1.5 rounded-lg border border-white/20 shrink-0" />
            <div>
              <h4 className="text-xs text-slate-300 tracking-wider uppercase font-semibold">केंद्रीय पुस्तकालय / CENTRAL LIBRARY</h4>
              <h3 className="text-sm font-bold tracking-wide">MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY ALLAHABAD - PRAYAGRAJ</h3>
              <div className="mt-2 inline-block bg-slate-800 border border-slate-700 text-amber-300 font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider">
                INSTITUTE IDENTITY CARD FORM FOR RESEARCH FELLOW UNDER PROJECT
              </div>
            </div>
          </div>

          <form onSubmit={handleApply} className="space-y-6 text-xs sm:text-sm">

            {/* Grid 1: Basic Identifiers & Photos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">

              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center justify-between">
                    <span>1- Identity Code / Roll Number <span className="text-red-500">*</span></span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold tracking-wide">
                      Auto-Generated by Computer
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={true}
                    placeholder="Fetching aucode..."
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value, identityCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 outline-none font-mono cursor-not-allowed font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    2- Candidate / Scholar Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name in CAPITAL letters"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 uppercase font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Designation / Fellow Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="JRF">JRF (Junior Research Fellow)</option>
                      <option value="SRF">SRF (Senior Research Fellow)</option>
                      <option value="RA">Research Associate</option>
                      <option value="Project Staff">Project Staff</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Project Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MNNIT/CSED/2026/01"
                      value={formData.projectNumber}
                      onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload Box */}
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <div className="w-32 h-40 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative group">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Candidate Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-3 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1">
                      <ImageIcon size={32} />
                      <span className="text-[11px] font-bold">CANDIDATE PHOTO <span className="text-red-500">*</span></span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition">
                    <Upload size={14} />
                    {formData.photoUrl ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photoUrl')} />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">Passport size image (JPG/PNG)</p>
                </div>
              </div>

            </div>

            {/* Grid 2: Addresses & Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Building size={16} className="text-blue-600" />
                  Local & Emergency Contact Details
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    3- Local Address (Prayagraj) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Hall of Residence / Hostel No / Local Residence"
                    value={formData.localAddress}
                    onChange={(e) => setFormData({ ...formData, localAddress: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Emergency Phone No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={formData.emergencyPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, emergencyPhone: val });
                      }}
                      className={`w-full px-3.5 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 font-mono ${formData.emergencyPhone && formData.emergencyPhone.length !== 10
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                        }`}
                    />
                    {formData.emergencyPhone && formData.emergencyPhone.length !== 10 ? (
                      <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">
                        Must be exact 10 digits ({formData.emergencyPhone.length}/10)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Exact 10 digits required</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Personal Mobile No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={formData.mobilePhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, mobilePhone: val });
                      }}
                      className={`w-full px-3.5 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 font-mono ${formData.mobilePhone && formData.mobilePhone.length !== 10
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                        }`}
                    />
                    {formData.mobilePhone && formData.mobilePhone.length !== 10 ? (
                      <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">
                        Must be exact 10 digits ({formData.mobilePhone.length}/10)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Exact 10 digits required</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    E-mail Address
                  </label>
                  <input
                    type="email"
                    placeholder="candidate@mnnit.ac.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <User size={16} className="text-blue-600" />
                  Permanent Address Details
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    5- Permanent Address (C/o) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="House No, Village/Street, Post"
                    value={formData.permAddress}
                    onChange={(e) => setFormData({ ...formData, permAddress: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      District
                    </label>
                    <input
                      type="text"
                      placeholder="District"
                      value={formData.permDistrict}
                      onChange={(e) => setFormData({ ...formData, permDistrict: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      placeholder="PIN"
                      value={formData.permPin}
                      onChange={(e) => setFormData({ ...formData, permPin: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols- gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      6- Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Category --</option>
                      <option value="Research Fellow">Research Fellow</option>
                      <option value="Project Staff">Project Staff</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      7- Addl. Category
                    </label>
                    <select
                      value={formData.addCategory}
                      onChange={(e) => setFormData({ ...formData, addCategory: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Addl. Category --</option>
                      <option value="GEN">GEN</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 3: Project & Personal Particulars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  10- Name of Project Investigator (PI)
                </label>
                <input
                  type="text"
                  placeholder="Prof. / Dr. PI Name"
                  value={formData.piName}
                  onChange={(e) => setFormData({ ...formData, piName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  11- Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Blood Group --</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  12- Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  13- Date of Joining <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.dateOfJoining}
                  onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Period (From - To)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formData.periodFrom}
                    onChange={(e) => setFormData({ ...formData, periodFrom: e.target.value })}
                    className="w-1/2 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                  <input
                    type="date"
                    value={formData.periodTo}
                    onChange={(e) => setFormData({ ...formData, periodTo: e.target.value })}
                    className="w-1/2 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  14- Sex / Gender <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Sex / Gender --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  15- Aadhar Number (UID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  placeholder="e.g. 4567-2589-7415"
                  value={formData.aadharNo}
                  onChange={(e) => {
                    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 12);
                    const formatted = rawDigits.replace(/(\d{4})(?=\d)/g, '$1-');
                    setFormData({ ...formData, aadharNo: formatted });
                  }}
                  className={`w-full px-3.5 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 font-mono ${formData.aadharNo && formData.aadharNo.replace(/\D/g, '').length !== 12
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                    }`}
                />
                {formData.aadharNo && formData.aadharNo.replace(/\D/g, '').length !== 12 ? (
                  <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">
                    Must be exact 12 digits ({formData.aadharNo.replace(/\D/g, '').length}/12)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Format: 4567-2589-7415 (12 digits)</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  16- Appointment Letter No.
                </label>
                <input
                  type="text"
                  placeholder="Letter No."
                  value={formData.appointmentLetterNo}
                  onChange={(e) => setFormData({ ...formData, appointmentLetterNo: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Enclosure: Copy of Appointment Letter
                </label>
                <label className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
                  <span className="truncate text-xs">{formData.documentName || 'Choose document file...'}</span>
                  <Upload size={14} className="text-slate-400" />
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'documentUrl')} />
                </label>
              </div>
            </div>

            {/* Signature Upload Section */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileSignature size={16} className="text-blue-600" />
                  Candidate Signature Upload <span className="text-red-500">*</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Please upload a clear scanned signature image on white background.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-48 h-16 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                  {formData.signatureUrl ? (
                    <img src={formData.signatureUrl} alt="Signature" className="max-h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">SIGNATURE IMAGE</span>
                  )}
                </div>
                <label className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition shrink-0">
                  <Upload size={14} />
                  {formData.signatureUrl ? 'Change Sign' : 'Upload Sign'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'signatureUrl')} />
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setViewMode('LIST'); resetFormData(); }}
                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-md"
              >
                <Send size={16} />
                {submitting
                  ? (editingCardId ? 'Updating Request...' : 'Submitting Form...')
                  : (editingCardId ? 'Update Candidate Request' : 'Submit Candidate Request')}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* VIEW MODE 2: REQUEST DETAIL & WORKFLOW TIMELINE PAGE */}
      {viewMode === 'DETAIL' && selectedCard && (
        <div className="space-y-6">

          {/* Detail View Header Toolbar */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setViewMode('LIST'); setSelectedCard(null); }}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Candidate Request Details
                  </h2>
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                    #{selectedCard.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Submitted on {new Date(selectedCard.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {(selectedCard.status === 'Pending PI Approval' || selectedCard.status === 'Pending Library Approval') && isItemOwner(selectedCard) && (
                <button
                  onClick={() => handleEdit(selectedCard)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Edit size={15} />
                  Edit Request
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStageBadgeClass(selectedCard.status)}`}>
                {selectedCard.status}
              </span>
              <button
                onClick={() => handlePrintForm(selectedCard)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Download size={15} />
                Download Form
              </button>
            </div>
          </div>

          {/* 2-COLUMN SPLIT VIEW: Candidate Request Form (Left) & Request Details / Timeline (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT 7 COLUMNS: CANDIDATE REQUEST FORM DISPLAY */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">

              <div className="flex items-center justify-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4 text-center">
                <img src="/images/MNNIT_LOGO.png" alt="MNNIT Logo" className="h-16 w-auto object-contain shrink-0" />
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">केंद्रीय पुस्तकालय / CENTRAL LIBRARY</h4>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY ALLAHABAD</h3>
                  <div className="mt-2 inline-block bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-md uppercase">
                    INSTITUTE IDENTITY CARD FORM FOR RESEARCH FELLOW UNDER PROJECT
                  </div>
                </div>
              </div>

              {(() => {
                const ext = parseFormRemarks(selectedCard);
                return (
                  <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">

                    {/* Upper row: Grid letters & Photo */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-3 flex-grow">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">1- Identity Code:</span>
                          <div className="flex gap-1 flex-wrap">
                            {(ext.identityCode || selectedCard.rollNumber || '').padEnd(14, ' ').slice(0, 14).split('').map((char, idx) => (
                              <span key={idx} className="w-5 h-6 border border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-900 text-center font-mono font-bold leading-6 text-slate-900 dark:text-slate-100 uppercase">
                                {char !== ' ' ? char : ''}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">2- Candidate Name:</span>
                          <div className="flex gap-1 flex-wrap">
                            {(ext.studentName || selectedCard.studentName || '').padEnd(16, ' ').slice(0, 16).split('').map((char, idx) => (
                              <span key={idx} className="w-5 h-6 border border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-900 text-center font-mono font-bold leading-6 text-slate-900 dark:text-slate-100 uppercase">
                                {char !== ' ' ? char : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="w-28 h-36 border-2 border-slate-300 dark:border-slate-600 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
                        {ext.photoUrl ? (
                          <img src={ext.photoUrl} alt="Candidate Photo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">PHOTO</span>
                        )}
                      </div>
                    </div>

                    {/* Details Table */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 flex">
                        <span className="font-bold w-40 shrink-0">3- Local Address:</span>
                        <span>{ext.localAddress || 'N/A'}</span>
                      </div>

                      <div className="p-2.5 flex flex-wrap gap-x-6 gap-y-1">
                        <div><span className="font-bold">4- Emergency Phone:</span> {ext.emergencyPhone || 'N/A'}</div>
                        <div><span className="font-bold">Mobile:</span> {ext.mobilePhone || 'N/A'}</div>
                        <div><span className="font-bold">E-mail:</span> {ext.email || 'N/A'}</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-x-6 gap-y-1">
                        <div><span className="font-bold">5- Permanent Address:</span> {ext.permAddress || 'N/A'}</div>
                        <div><span className="font-bold">District:</span> {ext.permDistrict || 'N/A'}</div>
                        <div><span className="font-bold">PIN:</span> {ext.permPin || 'N/A'}</div>
                      </div>

                      <div className="p-2.5 flex flex-wrap gap-6">
                        <div><span className="font-bold">6- Category:</span> <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded font-bold">{ext.category || 'Research Fellow'}</span></div>
                        <div><span className="font-bold">7- Addl Category:</span> <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold">{ext.addCategory || 'GEN'}</span></div>
                        <div><span className="font-bold">8- Designation:</span> {selectedCard.designation}</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-6">
                        <div><span className="font-bold">9- Project Number:</span> <span className="font-mono">{selectedCard.projectNumber || 'N/A'}</span></div>
                        <div><span className="font-bold">10- PI Name:</span> {ext.piName || 'N/A'}</div>
                      </div>

                      <div className="p-2.5 flex flex-wrap gap-6">
                        <div><span className="font-bold">11- Blood Group:</span> {ext.bloodGroup || 'N/A'}</div>
                        <div><span className="font-bold">12- DOB:</span> {ext.dob || 'N/A'}</div>
                        <div><span className="font-bold">14- Sex:</span> {ext.sex || 'Male'}</div>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-6">
                        <div><span className="font-bold">13- Date of Joining:</span> {ext.dateOfJoining || 'N/A'}</div>
                        <div><span className="font-bold">Period:</span> {ext.periodFrom || 'N/A'} To {ext.periodTo || 'N/A'}</div>
                      </div>

                      <div className="p-2.5 flex flex-wrap gap-6">
                        <div><span className="font-bold">15- Aadhar (UID):</span> <span className="font-mono">{ext.aadharNo || 'N/A'}</span></div>
                        <div><span className="font-bold">16- Appt Letter No:</span> {ext.appointmentLetterNo || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Uploaded Documents & Signature Preview */}
                    <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="font-bold block text-xs mb-1">Uploaded Documents:</span>
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-600" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {ext.documentName || 'Appointment_Letter_Copy.pdf'}
                          </span>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="font-bold block text-xs mb-1">Signature Image:</span>
                        <div className="w-40 h-12 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded flex items-center justify-center p-1">
                          {ext.signatureUrl ? (
                            <img src={ext.signatureUrl} alt="Signature" className="max-h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">Candidate Signature</span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

            </div>

            {/* RIGHT 5 COLUMNS: REQUEST DETAILS, TIMELINE & ROLE ACTIONS */}
            <div className="lg:col-span-5 space-y-6">

              {/* Request Summary Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                  Request Details
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Candidate:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCard.studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Roll / Enrollment:</span>
                    <span className="font-mono font-semibold">{selectedCard.rollNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-semibold">{selectedCard.departmentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Status:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${getStageBadgeClass(selectedCard.status)}`}>
                      {selectedCard.status}
                    </span>
                  </div>
                  {selectedCard.idCardNumber && (
                    <div className="flex justify-between bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">Issued ID Card No:</span>
                      <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">{selectedCard.idCardNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Workflow Approval Timeline */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                  Sequential Approval Workflow Timeline
                </h3>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">

                  {/* Step 1: Candidate */}
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                      <Check size={12} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Candidate Raised Request</h4>
                      <p className="text-[11px] text-slate-500">Submitted by {selectedCard.studentName}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(selectedCard.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Step 1: PI Review */}
                  <div className="relative flex items-start gap-3">
                    {getStageStepNumber(selectedCard.status) > 1 ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                        <Check size={12} />
                      </div>
                    ) : getStageStepNumber(selectedCard.status) === 1 ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs animate-pulse">
                        <Clock size={12} />
                      </div>
                    ) : selectedCard.status === 'Rejected' ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs">
                        <XCircle size={12} />
                      </div>
                    ) : (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                        1
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Stage 1: Principal Investigator (PI) Review</h4>
                      <p className="text-[11px] text-slate-500">
                        {getStageStepNumber(selectedCard.status) > 1 ? 'PI Forwarded Request' : getStageStepNumber(selectedCard.status) === 1 ? 'Pending PI Approval' : 'Awaiting Stage'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2: HOD Review */}
                  <div className="relative flex items-start gap-3">
                    {getStageStepNumber(selectedCard.status) > 2 ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                        <Check size={12} />
                      </div>
                    ) : getStageStepNumber(selectedCard.status) === 2 ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs animate-pulse">
                        <Clock size={12} />
                      </div>
                    ) : (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                        2
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Stage 2: Head of Department (HOD) Review</h4>
                      <p className="text-[11px] text-slate-500">
                        {getStageStepNumber(selectedCard.status) > 2 ? 'HOD Forwarded Request' : getStageStepNumber(selectedCard.status) === 2 ? 'Pending HOD Approval' : 'Awaiting Stage'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Dean Approval */}
                  <div className="relative flex items-start gap-3">
                    {selectedCard.status === 'Issued' ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                        <Check size={12} />
                      </div>
                    ) : getStageStepNumber(selectedCard.status) === 3 ? (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs animate-pulse">
                        <Clock size={12} />
                      </div>
                    ) : (
                      <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                        3
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Stage 3: Dean (R&C) Approval & Issuance</h4>
                      <p className="text-[11px] text-slate-500">
                        {selectedCard.status === 'Issued' ? 'Dean Approved & Card Issued' : getStageStepNumber(selectedCard.status) === 3 ? 'Pending Dean Approval' : 'Awaiting Stage'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Role Action & Approval Box */}
              {selectedCard.status !== 'Issued' && selectedCard.status !== 'Rejected' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <ShieldCheck className="text-blue-600" size={18} />
                    Process Workflow Stage
                  </h3>

                  {canUserActionStage(selectedCard.status) ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg text-xs text-blue-900 dark:text-blue-200 font-medium">
                        You have designated role permissions to action <strong>{selectedCard.status}</strong>.
                      </div>

                      {(selectedCard.status === 'Pending Dean Approval' || selectedCard.status === 'Pending') && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                            Custom ID Card Number (Optional Dean Override):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. MNNIT/JRF/2026/099"
                            value={customCardNo}
                            onChange={(e) => setCustomCardNo(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-mono"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Remarks / Notes:
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Enter approval comments or rejection reason..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        />
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          disabled={submitting}
                          onClick={() => handleProcessAction('Approve')}
                          className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ShieldCheck size={16} />
                          {submitting ? 'Processing...' : getNextStageLabel(selectedCard.status)}
                        </button>
                        <button
                          disabled={submitting}
                          onClick={() => handleProcessAction('Reject')}
                          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg text-center space-y-1">
                      <Clock size={24} className="text-slate-400" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {getRequiredRoleLabel(selectedCard.status)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        This request is awaiting action from designated role officers.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* VIEW MODE 3: DEFAULT REQUESTS LIST & TABBED QUEUE TABLE */}
      {viewMode === 'LIST' && (
        <div className="space-y-6">

          {/* 3-STAGE PIPELINE PREVIEW */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Role-Gated Sequential Approval Hierarchy Pipeline :
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 p-3 rounded-lg border border-purple-200 dark:border-purple-800/50">
                <User className="text-purple-600 shrink-0" size={18} />
                <div>
                  <span className="font-bold text-purple-950 dark:text-purple-200 block">Stage 1: PI</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">PI / Faculty Role</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50">
                <Building className="text-amber-600 shrink-0" size={18} />
                <div>
                  <span className="font-bold text-amber-950 dark:text-amber-200 block">Stage 2: HOD</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">HOD Role</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                <Award className="text-emerald-600 shrink-0" size={18} />
                <div>
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 block">Stage 3: Dean</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Dean Role</span>
                </div>
              </div>
            </div>
          </div>

          {/* FILTER TABS WITH COUNTS */}
          <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {[
              { key: 'ALL', label: 'All Requests' },
              { key: 'PI', label: 'PI Queue' },
              { key: 'HOD', label: 'HOD Queue' },
              { key: 'DEAN', label: 'Dean Queue' },
              { key: 'ISSUED', label: 'Issued Cards' },
              { key: 'REJECTED', label: 'Rejected' },
            ].map((tab) => {
              const count = getQueueCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${activeTab === tab.key
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* REQUESTS LIST TABLE */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="animate-spin" size={20} />
                Loading ID Card requests...
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm space-y-3">
                <CreditCard size={44} className="text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No ID Card requests found for this queue.</p>
                {isCandidateUser && (
                  <button
                    onClick={() => setViewMode('CREATE')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Raise Candidate Request
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-bold">
                    <tr>
                      <th className="px-4 py-3.5">Request No / Candidate</th>
                      <th className="px-4 py-3.5">Submitted Date</th>
                      <th className="px-4 py-3.5">Roll & Dept</th>
                      <th className="px-4 py-3.5">Current Status</th>
                      <th className="px-4 py-3.5">Workflow Progress</th>
                      <th className="px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredCards.map((item, idx) => {
                      const currentStep = getStageStepNumber(item.status);
                      const reqNo = `REQ-${(idx + 1).toString().padStart(3, '0')}`;
                      const isPendingStage = item.status === 'Pending PI Approval' || item.status === 'Pending Library Approval';
                      const isEditable = isPendingStage && isItemOwner(item);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {item.studentName || item.studentUserId || 'Research Scholar'}
                            </div>
                            <div className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {reqNo} ({item.designation || 'JRF'})
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-slate-500 font-medium">
                            {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{item.departmentName || 'Dept'}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">Roll: {item.rollNumber || 'N/A'}</div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getStageBadgeClass(item.status)}`}>
                              {item.status === 'Issued' && <CheckCircle size={14} />}
                              {item.status === 'Rejected' && <XCircle size={14} />}
                              {item.status !== 'Issued' && item.status !== 'Rejected' && <Clock size={14} />}
                              {item.status}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 text-[10px] font-semibold">
                              {[
                                { num: 1, name: 'PI' },
                                { num: 2, name: 'HOD' },
                                { num: 3, name: 'Dean' },
                              ].map((step, sIdx) => {
                                const isCompleted = currentStep > step.num;
                                const isCurrent = currentStep === step.num;
                                return (
                                  <div key={step.num} className="flex items-center gap-1">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isCompleted
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : isCurrent
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-slate-100 text-slate-400 border-slate-200'
                                        }`}
                                    >
                                      {step.name}
                                    </span>
                                    {sIdx < 2 && <span className="text-slate-300 text-[10px]">➔</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditable && (
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                  title="Edit Candidate Request"
                                >
                                  <Edit size={14} /> Edit
                                </button>
                              )}
                              {canUserActionStage(item.status) && (
                                <>
                                  <button
                                    disabled={submitting}
                                    onClick={() => handleTableAction(item, 'Approve')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                                    title={getNextStageLabel(item.status)}
                                  >
                                    <Send size={14} /> Forward
                                  </button>
                                  <button
                                    disabled={submitting}
                                    onClick={() => handleTableAction(item, 'Reject')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                                    title="Reject Request"
                                  >
                                    <XCircle size={14} /> Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => { setSelectedCard(item); setViewMode('DETAIL'); }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                <Eye size={14} /> View
                              </button>
                              {item.status === 'Issued' && (
                                <button
                                  onClick={() => handlePrintForm(item)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                >
                                  <Download size={14} /> Download
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

