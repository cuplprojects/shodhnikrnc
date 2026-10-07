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
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [screeningType, setScreeningType] = useState(6); // VC Office is step 6
  const [screeningStatus, setScreeningStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get permissions from location state or use default permissions
  const canApprove = hasPermission('vc_supervisor_approval.approve');
  const canReject = hasPermission('vc_supervisor_approval.reject');

  const previousStatus = location.state?.status || "all";
  const returnPath = location.state?.returnPath || `/vc-office-supervisor-approval`;

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

      const roleId = user?.roleID || user?.roleId;
      // Define mapping based on configured workflow
      // Step 1 = Supervisor Cell (roleId 16)
      // VC Office is Step 6 in configured supervisor workflow (WorkflowID 5)
      // Step 1 = Supervisor Cell / RAC (roleId 16)
      // Step 2 = Deputy Registrar (roleId 18)
      // Step 3 = Registrar (roleId 3)
      // Step 4 = Dean (roleId 8)
      // Step 5 = DOR / Director of Research (roleId 4)
      // Step 6 = VC Office (roleId 2 or 21)
      const type = 6;
      setScreeningType(type);

      // Try to get status from workflow history first
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
        if ((!logs || logs.length === 0) && screening && screening.screening6Status !== 0) {
          setScreeningStatus(screening.screening6Status === 1 ? "Approved" : "Rejected");
          setRemarks(screening.screening6Remark2 || screening.screening6Remark1 || "");
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
      subject: result.subjectName || "--",
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
      supId: result.supId || "--",
      feeExempted: result.feeExempted || false,
      exemptionReason: result.exemptionReason || "--"
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
    
    // Check if current step (step 6) is already approved in workflow history
    if (Array.isArray(workflowHistory) && workflowHistory.some(l => l.stepOrder === 6 && l.action === "Approve")) {
      return true;
    }
    
    if (!screeningData) return false;
    return screeningData.screening6Status === 1 || (screeningData.screening6Status === 2 && screeningData.screening6Count >= 2);
  };

  const handleSubmit = async () => {
    // Check permissions based on status
    if (screeningStatus === "Approved" && !canApprove) {
      notification().error("You do not have permission to approve");
      return;
    }

    if (screeningStatus === "Rejected" && !canReject) {
      notification().error("You do not have permission to reject");
      return;
    }

    if (!screeningStatus) {
      notification().error("Please select screening status");
      return;
    }
    if (screeningStatus === "Rejected" && !remarks.trim()) {
      notification().error("Remarks are required for Rejected status");
      return;
    }
    if (isScreeningLocked()) {
      notification().error("This screening step is already completed and locked.");
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
        notification().success("Approval submitted successfully");

        // Refresh screening data to update locked status
        await fetchScreeningDetails();

        navigate(returnPath.includes('?') ? returnPath : `${returnPath}?status=${previousStatus}`);
      } catch (error) {
        console.error("Error submitting approval:", error);
        notification().error("Failed to submit approval");
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
      @page { size: A4; margin: 8mm; orphans: 4; widows: 4; }
      body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: Helvetica, Arial, sans-serif !important; font-size: 8pt !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .print-wrapper { padding: 0 !important; background: white !important; margin: 0 !important; }
      .print-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 8mm !important; background: white !important; box-shadow: none !important; }
      
      /* Page break handling for tables */
      table { page-break-inside: avoid !important; border-collapse: collapse !important; border: 1px solid #000 !important; font-size: 8pt !important; width: 100% !important; table-layout: fixed !important; margin-bottom: 12px !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      tr { page-break-inside: avoid !important; }
      td, th { border: 1px solid #000 !important; padding: 3pt !important; font-size: 8pt !important; vertical-align: top !important; word-wrap: break-word !important; }
      
      /* Section styling - keep sections together */
      .section-title { margin-top: 12px !important; margin-bottom: 4pt !important; font-weight: bold !important; font-size: 10pt !important; text-transform: uppercase !important; text-align: left !important; page-break-inside: avoid !important; page-break-after: avoid !important; }
      .section-container { background-color: white !important; border: 1px solid #000 !important; margin-bottom: 12px !important; width: 100% !important; box-sizing: border-box !important; page-break-inside: avoid !important; }
      
      /* Prevent orphaned content */
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid !important; page-break-inside: avoid !important; margin-bottom: 4pt !important; }
      p { page-break-inside: avoid !important; margin: 0 !important; }
      
      /* Force page break before large sections if needed */
      div[style*="marginTop: 12px"] { page-break-inside: avoid !important; }
    }
    @media screen { 
      .print-container { width: 280mm; margin: 0 auto; }
      .section-container { width: 100%; }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <div className="print-wrapper" style={{ padding: "12px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
        <div className="print-container" style={{ maxWidth: "280mm", margin: "0 auto", backgroundColor: "white", padding: "6mm", boxSizing: "border-box" }}>
          <div style={{ marginBottom: "8px", display: "flex", gap: "8px" }} className="no-print">
            <Button module="vc_supervisor_approval" action="read" icon={<ArrowLeftOutlined />} label="Back to Applications" variant="outline" onClick={handleBack} />
            <Button module="vc_supervisor_approval" action="read" icon={<PrinterOutlined />} label="Print" variant="outline" onClick={handlePrint} />
          </div>

          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "0" }}>
            <div className="hidden sm:flex justify-center mt-2 mb-0"><PrintHeader /></div>
          </div>

          {/* Basic Information */}
          <div style={{ backgroundColor: "white", border: "1px solid #000", borderTop: "none", marginBottom: "12px", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "130pt", padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "10pt" }}>Registration No.</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000", fontSize: "10pt" }}>{application.user_id}</td>
                  <td style={{ width: "85pt", textAlign: "center", verticalAlign: "top", padding: "4pt" }} rowSpan="4">
                    <div style={{ marginBottom: "4pt" }}>
                      <img src={getFilePath(application.photo)} alt="Photo" style={{ width: "80pt", height: "95pt", border: "1px solid #ccc", objectFit: "cover" }} />
                    </div>
                    <div style={{ borderTop: "1px solid #ccc", paddingTop: "4pt" }}>
                      <img src={getFilePath(application.sign)} alt="Signature" style={{ width: "80pt", height: "35pt", objectFit: "contain" }} />
                    </div>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "10pt" }}>Present College</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000", fontSize: "10pt" }}>{application.college}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "10pt" }}>Department &<br />Estb. Year</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000", fontSize: "10pt" }}>{application.subject} ({application.est_year})</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "10pt" }}>Designation</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000", fontSize: "10pt" }}>{application.designation}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "10pt" }}>Research<br />Experience</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000", fontSize: "10pt" }}>{application.res_exp} Year(s)</td>
                  <td style={{ textAlign: "center", verticalAlign: "middle", padding: "4pt" }}></td>
                </tr>
                <tr style={{ borderTop: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5", fontSize: "9pt" }}>Payment Status</td>
                  <td style={{ padding: "4pt", fontSize: "9pt" }} colSpan="2">
                    {application.feeExempted ? (
                      <span style={{ color: "#059669", fontWeight: "bold" }}>✓ Fee Exempted</span>
                    ) : (
                      <>
                        <b>Txn Id:</b> {application.txn_id} | <b>Amount (&#8377;):</b> {application.txn_amt !== "--" ? parseFloat(application.txn_amt).toFixed(2) : "--"} | <b>Date:</b> {application.payment_date !== "--" ? new Date(application.payment_date).toLocaleDateString("en-GB") : "--"}
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Personal Details */}
          <div style={{ marginTop: "12px", marginBottom: "4pt", fontWeight: "bold", fontSize: "10pt", textTransform: "uppercase", textAlign: "left" }}>PERSONAL DETAILS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "12px", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "100pt", padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Name</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.name}</td>
                  <td style={{ width: "100pt", padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Father's Name</td>
                  <td style={{ padding: "4pt" }}>{application.fname}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Date of Birth</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.dob !== "--" ? new Date(application.dob).toLocaleDateString("en-GB") : "--"}</td>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Age</td>
                  <td style={{ padding: "4pt" }}>{application.dob !== "--" ? Math.floor((new Date() - new Date(application.dob)) / 31557600000) + " yrs" : "--"}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Gender</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.gender}</td>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Nationality</td>
                  <td style={{ padding: "4pt" }}>{application.nationality}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Identity Proof</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.id_type}</td>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>ID No.</td>
                  <td style={{ padding: "4pt" }}>{application.id_no}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Mailing Address</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.corr_address}, {application.corr_city?.toUpperCase()}, {application.corr_state?.toUpperCase()}, PIN-{application.corr_pin}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Permanent Address</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.perm_address}, {application.perm_city?.toUpperCase()}, {application.perm_state?.toUpperCase()}, PIN-{application.perm_pin}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Mobile No.</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.mobile}</td>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Email Id</td>
                  <td style={{ padding: "4pt" }}>{application.email}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PhD Details */}
          <div style={{ marginTop: "12px", marginBottom: "4pt", fontWeight: "bold", fontSize: "10pt", textTransform: "uppercase", textAlign: "left" }}>DETAILS OF PH.D.</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "12px", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ width: "110pt", padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>University</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.university}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Discipline</td>
                  <td style={{ padding: "4pt", borderRight: "1px solid #000" }}>{application.decipline}</td>
                  <td style={{ width: "90pt", padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Supervisor</td>
                  <td style={{ padding: "4pt" }}>{application.sup_name}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Area of Specialization</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.spl_area}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Thesis Title</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.thesis}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4pt", fontWeight: "bold", borderRight: "1px solid #000", backgroundColor: "#f5f5f5" }}>Awarded (Year & Month)</td>
                  <td style={{ padding: "4pt" }} colSpan="3">{application.duration}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Experience Details */}
          <div style={{ marginTop: "12px", marginBottom: "4pt", fontWeight: "bold", fontSize: "10pt", textTransform: "uppercase", textAlign: "left" }}>EXPERIENCE DETAILS</div>
          {application.experience && application.experience.length > 0 ? (
            <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "12px", width: "100%", boxSizing: "border-box" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", boxSizing: "border-box" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "5%", textAlign: "center", verticalAlign: "middle" }}>Sr.</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "15%", verticalAlign: "middle" }}>Organization</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "12%", verticalAlign: "middle" }}>Designation</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "10%", verticalAlign: "middle" }}>Category</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "14%", verticalAlign: "middle" }}>Period</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "10%", verticalAlign: "middle" }}>Exp.</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "18%", verticalAlign: "middle" }}>Area of Spec.</th>
                    <th style={{ border: "1px solid #000", padding: "3pt", fontWeight: "bold", width: "6%", textAlign: "center", verticalAlign: "middle" }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {application.experience.map((exp, index) => (
                    <tr key={exp.id || index}>
                      <td style={{ border: "1px solid #000", padding: "3pt", textAlign: "center", verticalAlign: "top", wordWrap: "break-word" }}>{index + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", wordWrap: "break-word" }}>{exp.organizationName}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", wordWrap: "break-word" }}>{exp.designation}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", wordWrap: "break-word" }}>{exp.category}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", fontSize: "7pt", wordWrap: "break-word" }}>
                        {exp.dateFrom !== "--" ? new Date(exp.dateFrom).toLocaleDateString('en-GB') : "--"}
                        {' to '}
                        {exp.dateTo ? new Date(exp.dateTo).toLocaleDateString('en-GB') : 'Present'}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", wordWrap: "break-word" }}>{exp.resExperience}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", verticalAlign: "top", wordWrap: "break-word" }}>{exp.areaOfSpec}</td>
                      <td style={{ border: "1px solid #000", padding: "3pt", textAlign: "center", verticalAlign: "top" }}>
                        {exp.doc ? (
                          <a href={getFilePath(exp.doc)} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline", fontSize: "7pt" }}>View</a>
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
            <div style={{ backgroundColor: "white", border: "1px solid #000", padding: "4pt", marginBottom: "12px", fontSize: "8pt", color: "#666", minHeight: "20pt", display: "flex", alignItems: "center", boxSizing: "border-box", width: "100%" }}>
              No experience details available
            </div>
          )}

          {/* Research Activities */}
          {application.res_act && (
            <>
              <div style={{ marginTop: "12px", marginBottom: "4pt", fontWeight: "bold", fontSize: "10pt", textTransform: "uppercase", textAlign: "left" }}>RESEARCH ACTIVITIES</div>
              <div style={{ backgroundColor: "white", border: "1px solid #000", padding: "4pt", marginBottom: "12px", lineHeight: "1.3", fontSize: "8pt", width: "100%", boxSizing: "border-box" }}>{application.res_act}</div>
            </>
          )}

          {/* Research Papers */}
          <div style={{ marginTop: "12px", marginBottom: "4pt", fontWeight: "bold", fontSize: "10pt", textTransform: "uppercase", textAlign: "left" }}>RESEARCH PAPERS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "12px", width: "100%", boxSizing: "border-box" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", boxSizing: "border-box" }}>
              <thead style={{ display: "table-header-group" }}>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={{ width: "5%", padding: "3pt", border: "1px solid #000", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Sr.</th>
                  <th style={{ width: "20%", padding: "3pt", border: "1px solid #000", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Title</th>
                  <th style={{ width: "75%", padding: "3pt", border: "1px solid #000", textAlign: "center", fontWeight: "bold", verticalAlign: "middle" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {application.publications && application.publications.length > 0 ? (
                  application.publications.map((pub, index) => (
                    <tr key={index}>
                      <td style={{ padding: "3pt", border: "1px solid #000", textAlign: "center", verticalAlign: "top", wordWrap: "break-word" }}>{index + 1}</td>
                      <td style={{ padding: "3pt", border: "1px solid #000", verticalAlign: "top", lineHeight: "1.2", wordWrap: "break-word" }}>{pub.title}</td>
                      <td style={{ padding: "3pt", border: "1px solid #000", lineHeight: "1.3", verticalAlign: "top", fontSize: "7pt", wordWrap: "break-word" }}>
                        <b>Year:</b> {pub.year} | <b>Journal:</b> {pub.journal}<br />
                        <b>Author:</b> {pub.author} | <b>ISSN:</b> {pub.issno}<br />
                        <b>Vol:</b> {pub.volume} | <b>Page:</b> {pub.page} | <b>Listed:</b> {pub.category}<br />
                        <b>UGC:</b> {pub.ugcno} | <b>Citations:</b> {pub.citations} | <b>IF:</b> {pub.impact}<br />
                        <a href={pub.url.startsWith("www.") ? `http://${pub.url}` : pub.url} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}>URL</a>
                        {pub.file_name && (<> | <a href={getFilePath(pub.file_name)} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}>Paper</a></>)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="3" style={{ padding: "6pt", border: "1px solid #000", textAlign: "center", color: "#666", fontSize: "8pt" }}>No publications available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Screening Decision Section */}
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
                <div>
                  <strong>Screening 6 (VC Office):</strong>
                  {(() => {
                    const step6Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 6) : null;
                    if (step6Log) {
                      return step6Log.action === "Approve" ? " ✓ Final Approved" : " ✗ Final Rejected";
                    }
                    return screeningData.screening6Status === 1 ? " Approved" : screeningData.screening6Status === 2 ? " Final Rejected" : " Pending";
                  })()}
                  {screeningData.screening6Count >= 2 && " (Final)"}
                </div>
              </div>
            )}

            {/* Locked Message */}
            {currentScreeningLocked && (() => {
              // Check workflow history for VC Office's step (Step 6 - Final Step)
              const vcStepLog = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 6) : null;
              const isApproved = vcStepLog?.action === "Approve";
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
                    ? "Final approval completed - Supervisor activated" 
                    : isLocked 
                      ? "Application rejected twice - status locked" 
                      : "VC Office approval completed"}
                </div>
              );
            })()}

            {/* Status Selection */}
            {!currentScreeningLocked && (canApprove || canReject) ? (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                    VC Office Final Approval Status:
                  </label>
                  <div style={{ display: "flex", gap: "20px" }}>
                    {canApprove && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="screening-status"
                          value="Approved"
                          checked={screeningStatus === "Approved"}
                          onChange={(e) => setScreeningStatus(e.target.value)}
                          className="w-4 h-4 text-slate-600 border-gray-300 focus:ring-slate-500"
                        />
                        <span style={{ color: "#16a34a", fontWeight: "500" }}>✓ Final Approved</span>
                      </label>
                    )}
                    {canReject && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="screening-status"
                          value="Rejected"
                          checked={screeningStatus === "Rejected"}
                          onChange={(e) => setScreeningStatus(e.target.value)}
                          className="w-4 h-4 text-slate-600 border-gray-300 focus:ring-slate-500"
                        />
                        <span style={{ color: "#dc2626", fontWeight: "500" }}>✗ Final Rejected</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Remarks Section */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                    Remarks:
                    {screeningStatus === "Rejected" && <span style={{ color: "#dc2626", marginLeft: "4px" }}>*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks for Screening 6 (VC Office)..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                    style={{ borderRadius: "6px", fontSize: "14px" }}
                  />
                </div>

                {/* Action Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                  <Button
                    module="vc_supervisor_approval"
                    action="approve"
                    label="Submit Final Decision"
                    variant="solid"
                    size="md"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={submitting || !screeningStatus ||
                      (screeningStatus === "Approved" && !canApprove) ||
                      (screeningStatus === "Rejected" && !canReject)}
                    className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md border-0"
                    style={{ backgroundColor: "#475569", borderColor: "#475569", color: "white", borderRadius: "6px", fontWeight: "500", height: "40px", paddingLeft: "20px", paddingRight: "20px", border: "none" }}
                  />
                </div>
              </>
            ) : !currentScreeningLocked ? (
              <div style={{ padding: "16px", backgroundColor: "#fff7e6", border: "1px solid #ffd591", borderRadius: "4px", color: "#d46b08", textAlign: "center" }}>
                You do not have permission to approve or reject this application.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorDetails;
