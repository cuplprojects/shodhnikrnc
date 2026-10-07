import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { fetchSupervisorPersonalDetails, fetchScreeningData, createOrUpdateScreening } from "@/services/supervisorRecognitionCellService";
import workflowService from "@/services/workflowService";
import { parseWorkflowHistoryResponse } from "@/utils/workflowStepMapper";
import { getFilePath } from "@/utils/fileUtils";
import Button from '@/components/ui/Button';
import PrintHeader from '@/components/cms/PrintHeader';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import useStaffAuthStore from '@/store/staffAuthStore';
import { hasPermission } from '@/services/hasPermissionService';

const Spin = ({ size = "default", children }) => {
  const sizeMap = { small: "w-4 h-4", default: "w-8 h-8", large: "w-12 h-12" };
  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeMap[size]} border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin`}></div>
      {children}
    </div>
  );
};

const ArrowLeftOutlined = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const PrinterOutlined = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const SupervisorDetails = () => {

  //permissions
  const canRead = hasPermission('registrar_supervisor_approval.read')
  const canCreate = hasPermission('registrar_supervisor_approval.create')
  const canUpdate = hasPermission('registrar_supervisor_approval.update')
  const canDelete = hasPermission('registrar_supervisor_approval.delete')
  const canApprove = hasPermission('registrar_supervisor_approval.approve')
  const canReject = hasPermission('registrar_supervisor_approval.reject')
  const canPrint = hasPermission('registrar_supervisor_approval.print')
  if (!canRead) {
    return;
  }

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [screeningType, setScreeningType] = useState(3); // Registrar is step 3
  const [screeningStatus, setScreeningStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notify = notification();

  const previousStatus = location.state?.status || "all";
  const returnPath = location.state?.returnPath || `/registrar-supervisor-approval`;

  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [workflowInstance, setWorkflowInstance] = useState(null);

  useEffect(() => {
    fetchSupervisorDetails();
    fetchScreeningDetails();
  }, [id]);

  const fetchScreeningDetails = async () => {
    try {
      const screening = await fetchScreeningData(id);
      setScreeningData(screening);

      // Fetch workflow history and instance
      const historyResponse = await workflowService.getEntityHistory("Supervisor", id);
      const { logs, instance } = parseWorkflowHistoryResponse(historyResponse);
      
      setWorkflowHistory(Array.isArray(logs) ? logs : []);
      setWorkflowInstance(instance);

      // Registrar is Step 3 in configured supervisor workflow (WorkflowID 5)
      // Step 1 = Supervisor Cell / RAC (roleId 16)
      // Step 2 = Deputy Registrar (roleId 18)
      // Step 3 = Registrar (roleId 3)
      // Step 4 = Dean (roleId 8)
      // Step 5 = DOR / Director of Research (roleId 4)
      // Step 6 = VC Office (roleId 2 or 21)
      const type = 3;
      setScreeningType(type);

      // Try to get status from workflow history first for Registrar's step (Step 3)
      const myStepLog = Array.isArray(logs) ? logs.find(l => l.stepOrder === type) : null;
      if (myStepLog) {
        // Use the workflow engine status
        setScreeningStatus(myStepLog.action === "Approve" ? "Approved" : "Rejected");
        setRemarks(myStepLog.comments || "");
      } else {
        // No workflow history for this step yet
        setScreeningStatus("");
        setRemarks("");
        
        // Fallback to legacy screening data only if workflow history is completely empty
        if ((!logs || logs.length === 0) && screening && screening.screening3Status !== 0) {
          setScreeningStatus(screening.screening3Status === 1 ? "Approved" : "Rejected");
          setRemarks(screening.screening3Remark2 || screening.screening3Remark1 || "");
        }
      }
    } catch (error) {
      console.error("Error fetching screening data:", error);
    }
  };

  const mapApiResponse = (result) => {
    const education = result.education?.[0] || {};
    const registration = result.registration || {};
    return {
      user_id: registration.applicationNumber || "--",
      name: `${registration.title || ""} ${registration.fullName || ""}`.trim() || "--",
      fname: registration.fatherName || "--",
      dob: result.dateOfBirth || "--",
      gender: result.gender || "--",
      nationality: result.nationality || "--",
      id_type: result.identityProofName || "--",
      id_no: result.identityProofNo || "--",
      mobile: registration.mobileNo || "--",
      email: registration.email || "--",
      corr_address: result.coAddress || "--",
      corr_city: result.coDistrict || "--",
      corr_state: result.coState || "--",
      corr_pin: result.coPinCode || "--",
      perm_address: result.peAddress || "--",
      perm_city: result.peDistrict || "--",
      perm_state: result.peState || "--",
      perm_pin: result.pePinCode || "--",
      college: education.collegeName || "--",
      subject: education.subject || "--",
      est_year: education.deptEst || "--",
      designation: result.designationName || "--",
      dor: result.retirementDate || "--",
      res_exp: education.researchExp || "--",
      university: education.universityName || "--",
      decipline: education.phdSubject || "--",
      sup_name: education.supervisorName || "--",
      spl_area: education.areaOfSpec || "--",
      thesis: education.thesisTitle || "--",
      duration: education.monthAndYear || "--",
      res_act: education.description || "--",
      experience: result.experience?.map(exp => ({
        id: exp.id,
        organizationName: exp.organizationName || "--",
        designation: exp.designation || "--",
        category: exp.category || "--",
        dateFrom: exp.dateFrom || "--",
        dateTo: exp.dateTo || null,
        resExperience: exp.resExperience || "--",
        areaOfSpec: exp.areaOfSpec || "--",
        doc: exp.doc || null
      })) || [],
      publications: result.research?.map(paper => ({
        title: paper.titleOfPaper || "--", year: paper.pubYear || "--", journal: paper.journalName || "--",
        author: paper.authorName || "--", issno: paper.issNo || "--", volume: paper.volume || "--",
        page: paper.page?.toString() || "--", category: paper.listedIn || "--", ugcno: paper.ugcListNo || "--",
        citations: paper.citations || "--", impact: paper.impactFactor || "--", url: paper.webUrl || "#",
        file_name: paper.uploadPaper || null
      })) || [],
      txn_id: result.transaction?.txnNo || result.transaction?.TxnNo || "--",
      txn_amt: result.transaction?.totalFee || result.transaction?.TotalFee || "0.00",
      payment_date: result.transaction?.txnDate || result.transaction?.TxnDate || "--",
      photo: result.supUploads?.photo || "photo.jpg",
      sign: result.supUploads?.sign || "signature.jpg",
      exp_cert: result.supUploads?.teachExp || "experience.pdf",
      appt_letter: result.supUploads?.appLetter || "appointment.pdf",
      supId: result.supId || "--"
    };
  };

  const fetchSupervisorDetails = async () => {
    setLoading(true);
    try {
      const result = await fetchSupervisorPersonalDetails(id);
      setApplication(mapApiResponse(result));
    } catch (error) {
      console.error("Error fetching application details:", error);
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(returnPath.includes('?') ? returnPath : `${returnPath}?status=${previousStatus}`);
  };

  const handlePrint = () => window.print();

  const isScreeningLocked = () => {
    // Check if workflow instance is locked (rejected twice)
    if (workflowInstance?.isLocked) {
      return true;
    }
    
    const type = 3; // Registrar is step 3

    // If workflow has already progressed beyond Registrar or is already approved
    if (workflowInstance && (workflowInstance.currentStepOrder > type || workflowInstance.status === "Approved")) {
      return true;
    }

    // Check if current step is already approved in workflow history
    if (Array.isArray(workflowHistory) && workflowHistory.some(l => l.stepOrder === type && l.action === "Approve")) {
      return true;
    }

    // Check if rejected twice at this step
    if (workflowInstance?.currentStepOrder === type && workflowInstance?.currentStepRejectionCount >= 2) {
      return true;
    }
    
    // Fallback for legacy data only if workflow instance is absent
    if (!workflowInstance && screeningData) {
      return screeningData.screening3Status === 1 || (screeningData.screening3Status === 2 && screeningData.screening3Count >= 2);
    }

    return false;
  };

  const handleSubmit = async () => {
    if (!screeningStatus) {
      notify.error("Please select screening status");
      return;
    }
    if (screeningStatus === "Rejected" && !remarks.trim()) {
      notify.error("Remarks are required for Rejected status");
      return;
    }
    if (isScreeningLocked()) {
      notify.error("This screening step is already completed and locked.");
      return;
    }

    const confirmed = await confirm({
      title: "Confirm Submission",
      message: "Are you sure you want to submit the Approval?"
    });

    if (confirmed) {
      setSubmitting(true);
      try {
        const actionRequest = {
          entityId: parseInt(id),
          entityType: "Supervisor",
          action: screeningStatus === "Approved" ? "Approve" : "Reject",
          comments: remarks,
          userId: user?.id,
          workflowName: "Supervisor Registration"
        };

        await workflowService.submitApprovalAction(actionRequest);
        notify.success("Approval submitted successfully");

        // Refresh screening data to update locked status
        await fetchScreeningDetails();

        navigate(returnPath.includes('?') ? returnPath : `${returnPath}?status=${previousStatus}`);
      } catch (error) {
        console.error("Error submitting approval:", error);
        notify.error("Failed to submit approval");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spin size="large" /></div>;
  if (!application) return <div className="p-6"><div className="text-center text-red-600">Application not found</div></div>;

  const currentScreeningLocked = isScreeningLocked();

  const printStyles = `
    @media print {
      @page { size: A4; margin: 8mm; }
      body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: Helvetica, Arial, sans-serif !important; font-size: 8pt !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .print-wrapper { padding: 0 !important; background: white !important; margin: 0 !important; }
      .print-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 8mm !important; background: white !important; box-shadow: none !important; }
      table { page-break-inside: auto !important; border-collapse: collapse !important; border: 1px solid #000 !important; font-size: 8pt !important; }
      tr { page-break-inside: avoid !important; }
      td, th { border: 1px solid #000 !important; padding: 3pt !important; font-size: 8pt !important; }
    }
    @media screen { .print-container { width: 280mm; margin: 0 auto; } }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <div className="print-wrapper" style={{ padding: "24px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
        <div className="print-container" style={{ maxWidth: "280mm", margin: "0 auto", backgroundColor: "white", padding: "10mm" }}>
          <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }} className="no-print">
            <Button module="registrar_supervisor_approval" action="read" icon={<ArrowLeftOutlined />} label="Back to Applications" variant="outline" onClick={handleBack} />
            {canPrint &&
              <Button module="registrar_supervisor_approval" action="read" icon={<PrinterOutlined />} label="Print" variant="outline" onClick={handlePrint} />
            }
          </div>

          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "0" }}>
            <div className="hidden sm:flex justify-center mt-3 mb-0"><PrintHeader /></div>
          </div>

          {/* Basic Information */}
          <div style={{ backgroundColor: "white", border: "1px solid #000", borderTop: "none", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "130pt", padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Registration No.</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.user_id}</td>
                  <td style={{ width: "100pt", textAlign: "center", verticalAlign: "middle", padding: "6pt" }} rowSpan="5">
                    <img src={getFilePath(application.photo)} alt="Photo" style={{ width: "90pt", height: "110pt", border: "1px solid #ccc", objectFit: "cover" }} />
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Present College</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.college}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Department &<br />Estb. Year</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.subject}&({application.est_year})</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Designation</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.designation}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Date of<br />Retirement</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.dor !== "--" ? new Date(application.dor).toLocaleDateString("en-GB") : "--"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Research<br />Experience</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.res_exp} Year(s)</td>
                  <td style={{ textAlign: "center", verticalAlign: "middle", padding: "6pt" }}>
                    <img src={getFilePath(application.sign)} alt="Signature" style={{ width: "120pt", height: "50pt", objectFit: "contain" }} />
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Payment Details</td>
                  <td style={{ padding: "6pt" }} colSpan="2">
                    <b>Txn Id :</b> {application.txn_id} &nbsp;&nbsp;&nbsp;
                    <b>Amount (&#8377;) :</b> {application.txn_amt !== "--" ? parseFloat(application.txn_amt).toFixed(2) : "--"} &nbsp;&nbsp;&nbsp;
                    <b>Txn Date:</b> {application.payment_date !== "--" ? new Date(application.payment_date).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Personal Details */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }}>PERSONAL DETAILS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "110pt", padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Name</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.name}</td>
                  <td style={{ width: "110pt", padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Father's Name</td>
                  <td style={{ padding: "6pt" }}>{application.fname}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Date of Birth</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.dob !== "--" ? new Date(application.dob).toLocaleDateString("en-GB") : "--"}</td>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Age</td>
                  <td style={{ padding: "6pt" }}>{application.dob !== "--" ? Math.floor((new Date() - new Date(application.dob)) / 31557600000) + " years" : "--"}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Gender</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.gender}</td>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Nationality</td>
                  <td style={{ padding: "6pt" }}>{application.nationality}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Identity Proof</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.id_type}</td>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Identity Proof No.</td>
                  <td style={{ padding: "6pt" }}>{application.id_no}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Mailing<br />Address</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.corr_address}, {application.corr_city?.toUpperCase()}, {application.corr_state?.toUpperCase()}, PIN-{application.corr_pin}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Permanent<br />Address</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.perm_address}, {application.perm_city?.toUpperCase()}, {application.perm_state?.toUpperCase()}, PIN-{application.perm_pin}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Mobile No.</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.mobile}</td>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Email Id</td>
                  <td style={{ padding: "6pt" }}>{application.email}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PhD Details */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }}>DETAILS OF PH.D.</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "130pt", padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Name of<br />University</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.university}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Discipline</td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>{application.decipline}</td>
                  <td style={{ width: "80pt", padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Supervisor Name</td>
                  <td style={{ padding: "6pt" }}>{application.sup_name}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Area of<br />Specialization</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.spl_area}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Title of Thesis</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.thesis}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Awarded<br />(Year & Month)</td>
                  <td style={{ padding: "6pt" }} colSpan="3">{application.duration}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Experience Details */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }}>EXPERIENCE DETAILS</div>
          {application.experience && application.experience.length > 0 ? (
            <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Sr. No.</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Organization</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Designation</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Category</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Period</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Experience</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Area of Spec.</th>
                    <th style={{ border: "1px solid #000", padding: "6pt", fontWeight: "bold" }}>Document</th>
                  </tr>
                </thead>
                <tbody>
                  {application.experience.map((exp, index) => (
                    <tr key={exp.id || index}>
                      <td style={{ border: "1px solid #000", padding: "6pt", textAlign: "center" }}>{index + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>{exp.organizationName}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>{exp.designation}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>{exp.category}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>
                        {exp.dateFrom !== "--" ? new Date(exp.dateFrom).toLocaleDateString('en-GB') : "--"}
                        {' to '}
                        {exp.dateTo ? new Date(exp.dateTo).toLocaleDateString('en-GB') : 'Present'}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>{exp.resExperience}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt" }}>{exp.areaOfSpec}</td>
                      <td style={{ border: "1px solid #000", padding: "6pt", textAlign: "center" }}>
                        {exp.doc ? (
                          <a href={getFilePath(exp.doc)} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}>View</a>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", border: "1px solid #000", padding: "8pt", marginBottom: "16px", fontSize: "9pt", color: "#666" }}>
              No experience details available
            </div>
          )}

          {/* Research Activities */}
          {application.res_act && (
            <>
              <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }}>RESEARCH ACTIVITIES</div>
              <div style={{ backgroundColor: "white", padding: "8pt", marginBottom: "18px", lineHeight: "1.4", fontSize: "9pt" }}>{application.res_act}</div>
            </>
          )}

          {/* Research Papers */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }}>RESEARCH PAPERS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
              <thead style={{ display: "table-header-group" }}>
                <tr style={{ borderBottom: "1px solid #000", backgroundColor: "#f5f5f5" }}>
                  <th style={{ width: "30pt", padding: "6pt", borderRight: "1px solid #000", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Sr. No.</th>
                  <th style={{ width: "120pt", padding: "6pt", borderRight: "1px solid #000", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Title of Paper</th>
                  <th style={{ padding: "6pt", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {application.publications && application.publications.length > 0 ? (
                  application.publications.map((pub, index) => (
                    <tr key={index} style={{ borderBottom: index === application.publications.length - 1 ? "none" : "1px solid #000" }}>
                      <td style={{ padding: "6pt", borderRight: "1px solid #000", textAlign: "center", verticalAlign: "middle" }}>{index + 1}</td>
                      <td style={{ padding: "6pt", borderRight: "1px solid #000", verticalAlign: "middle", lineHeight: "1.3" }}>{pub.title}</td>
                      <td style={{ padding: "6pt", lineHeight: "1.5", verticalAlign: "middle" }}>
                        <b>Year of Publication:</b> {pub.year}, &nbsp;&nbsp;&nbsp;<b>Name of Journal:</b> {pub.journal}<br />
                        <b>Author(s):</b> {pub.author}<br />
                        <b>ISSN No.:</b> {pub.issno}, &nbsp;&nbsp;&nbsp;<b>Volume:</b> {pub.volume}, &nbsp;&nbsp;&nbsp;<b>Page No.:</b> {pub.page}<br />
                        <b>Listed In:</b> {pub.category}, &nbsp;&nbsp;&nbsp;<b>UGC List No.:</b> {pub.ugcno}<br />
                        <b>Citations:</b> {pub.citations}, &nbsp;&nbsp;&nbsp;&nbsp;<b>Impact Factor:</b> {pub.impact}<br />
                        <b>Web URL:</b> <a href={pub.url.startsWith("www.") ? `http://${pub.url}` : pub.url} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}>Click Here</a>
                        {pub.file_name && (<>, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href={`/Uploads/NewSup/${pub.file_name}`} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}><b>Attached Paper</b></a></>)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="3" style={{ padding: "12pt", textAlign: "center", color: "#666" }}>No publications available</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Screening Decision Section */}
          {(canApprove || canReject) &&
            <div style={{ marginTop: "32px", backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }} className="no-print">
              <div style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "16px 20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "0", color: "#1f2937" }}>Screening Decision</h3>
              </div>
              <div style={{ padding: "20px" }}>
                {/* Current Screening Info */}
                {screeningData && (
                  <div style={{ padding: "12px 16px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
                    <div style={{ marginBottom: "8px", fontWeight: "600" }}>Current Screening Status:</div>
                    <div>
                      <strong>Screening 1 (Supervisor Cell):</strong>
                      {(() => {
                        const step1Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 1) : null;
                        if (step1Log) {
                          return step1Log.action === "Approve" ? " ✓ Provisional Accepted" : " ✗ Rejected";
                        }
                        return screeningData.screening1Status === 1 ? " Provisional Accepted" : screeningData.screening1Status === 2 ? " Rejected" : " Pending";
                      })()}
                      {screeningData.screening1Count >= 2 && " (Final)"}
                    </div>
                    <div>
                      <strong>Screening 2 (Dean):</strong>
                      {(() => {
                        const step2Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 2) : null;
                        if (step2Log) {
                          return step2Log.action === "Approve" ? " ✓ Accepted" : " ✗ Rejected";
                        }
                        return screeningData.screening2Status === 1 ? " Accepted" : screeningData.screening2Status === 2 ? " Rejected" : " Pending";
                      })()}
                      {screeningData.screening2Count >= 2 && " (Final)"}
                    </div>
                    <div>
                      <strong>Screening 3 (DOR):</strong>
                      {(() => {
                        const step3Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 3) : null;
                        if (step3Log) {
                          return step3Log.action === "Approve" ? " ✓ Approved" : " ✗ Rejected";
                        }
                        return screeningData.screening3Status === 1 ? " Approved" : screeningData.screening3Status === 2 ? " Rejected" : " Pending";
                      })()}
                      {screeningData.screening3Count >= 2 && " (Final)"}
                    </div>
                    <div>
                      <strong>Screening 4 (Deputy Registrar):</strong>
                      {(() => {
                        const step4Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 4) : null;
                        if (step4Log) {
                          return step4Log.action === "Approve" ? " ✓ Approved" : " ✗ Rejected";
                        }
                        return screeningData.screening4Status === 1 ? " Approved" : screeningData.screening4Status === 2 ? " Rejected" : " Pending";
                      })()}
                      {screeningData.screening4Count >= 2 && " (Final)"}
                    </div>
                    <div>
                      <strong>Screening 5 (Registrar):</strong>
                      {(() => {
                        const step5Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 5) : null;
                        if (step5Log) {
                          return step5Log.action === "Approve" ? " ✓ Approved" : " ✗ Rejected";
                        }
                        return screeningData.screening5Status === 1 ? " Approved" : screeningData.screening5Status === 2 ? " Rejected" : " Pending";
                      })()}
                      {screeningData.screening5Count >= 2 && " (Final)"}
                    </div>
                  </div>
                )}

                {/* Locked Message */}
                {currentScreeningLocked && (() => {
                  // Check workflow history for Registrar's step (Step 3)
                  const registrarStepLog = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 3) : null;
                  const isApproved = registrarStepLog?.action === "Approve" || workflowInstance?.currentStepOrder > 3 || workflowInstance?.status === "Approved";
                  const isLocked = workflowInstance?.isLocked;
                  
                  return (
                    <div style={{ 
                      padding: "12px 16px", 
                      backgroundColor: isApproved ? "#dcfce7" : "#fef2f2", 
                      border: `1px solid ${isApproved ? "#86efac" : "#fecaca"}`, 
                      borderRadius: "6px", 
                      marginBottom: "16px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      fontSize: "14px", 
                      color: isApproved ? "#166534" : "#991b1b", 
                      fontWeight: "500" 
                    }}>
                      🔒 {isApproved 
                        ? "Registrar approval completed - Application forwarded to Dean" 
                        : isLocked 
                          ? "Application rejected twice - status locked" 
                          : "Registrar approval completed"}
                    </div>
                  );
                })()}

                {/* Status Selection */}
                {!currentScreeningLocked && (
                  <>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                        Registrar Office Screening Status:
                      </label>
                      <div style={{ display: "flex", gap: "20px" }}>
                        {canApprove && <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="screening-status"
                              value="Approved"
                              checked={screeningStatus === "Approved"}
                              onChange={(e) => setScreeningStatus(e.target.value)}
                              className="w-4 h-4 text-slate-600 border-gray-300 focus:ring-slate-500"
                            />
                            <span style={{ color: "#16a34a", fontWeight: "500" }}>✓ Approved</span>
                          </label>
                        </>}

                        {canReject && <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="screening-status"
                              value="Rejected"
                              checked={screeningStatus === "Rejected"}
                              onChange={(e) => setScreeningStatus(e.target.value)}
                              className="w-4 h-4 text-slate-600 border-gray-300 focus:ring-slate-500"
                            />
                            <span style={{ color: "#dc2626", fontWeight: "500" }}>✗ Rejected</span>
                          </label>
                        </>}
                      </div>
                    </div>

                    {/* Remarks Section */}
                    {canReject && <>
                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                          Remarks:
                          {screeningStatus === "Rejected" && <span style={{ color: "#dc2626", marginLeft: "4px" }}>*</span>}
                        </label>
                        <textarea
                          rows={3}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Enter remarks for Screening 3 (Registrar)..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                          style={{ borderRadius: "6px", fontSize: "14px" }}
                        />
                      </div>
                    </>}
                    {/* Action Button */}
                    {(canApprove || canReject) &&
                      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                        <Button
                          module="registrar_supervisor_approval"
                          action="approve"
                          label="Send to Dean"
                          variant="solid"
                          size="md"
                          onClick={handleSubmit}
                          loading={submitting}
                          disabled={submitting}
                          className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md border-0"
                          style={{ backgroundColor: "#475569", borderColor: "#475569", color: "white", borderRadius: "6px", fontWeight: "500", height: "40px", paddingLeft: "20px", paddingRight: "20px", border: "none" }}
                        />
                      </div>
                    }
                  </>
                )}
              </div>
            </div>
          }
        </div>
      </div>
    </>
  );
};

export default SupervisorDetails;
