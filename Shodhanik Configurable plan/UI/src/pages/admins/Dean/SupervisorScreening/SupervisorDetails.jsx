import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { fetchSupervisorPersonalDetails, fetchScreeningData, createOrUpdateScreening } from "@/services/supervisorRecognitionCellService";
import workflowService from "@/services/workflowService";
import { parseWorkflowHistoryResponse } from "@/utils/workflowStepMapper";
import { getFilePath } from "@/utils/fileUtils";
import { Button } from 'antd';
import PrintHeader from '@/components/cms/PrintHeader';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import useStaffAuthStore from '@/store/staffAuthStore';

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

const SupervisorStageIV = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [screeningType, setScreeningType] = useState(4); // Dean is step 4
  const [screeningStatus, setScreeningStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const previousStatus = location.state?.status || "all";
  const returnPath = location.state?.returnPath || `/dean-supervisor-consent`;

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

      // Dean is Step 4 in configured supervisor workflow (WorkflowID 5)
      // Step 1 = Supervisor Cell / RAC (roleId 16)
      // Step 2 = Deputy Registrar (roleId 18)
      // Step 3 = Registrar (roleId 3)
      // Step 4 = Dean (roleId 8)
      // Step 5 = DOR / Director of Research (roleId 4)
      // Step 6 = VC Office (roleId 2 or 21)
      const type = 4;
      setScreeningType(type);

      // Try to get status from workflow history first for Dean's step (Step 4)
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
        if ((!logs || logs.length === 0) && screening && screening.screening4Status !== 0) {
          setScreeningStatus(screening.screening4Status === 1 ? "Approved" : "Rejected");
          setRemarks(screening.screening4Remark2 || screening.screening4Remark1 || "");
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
      // Basic Info
      user_id: registration.applicationNumber || "--",
      name: `${registration.title || ""} ${registration.fullName || ""}`.trim() || "--",
      fname: registration.fatherName || "--",
      dob: result.dateOfBirth || "--",
      gender: result.gender || "--",
      nationality: result.nationality || "--",

      // Identity
      id_type: result.identityProofName || "--",
      id_no: result.identityProofNo || "--",

      // Contact
      mobile: registration.mobileNo || "--",
      email: registration.email || "--",

      // Addresses
      corr_address: result.coAddress || "--",
      corr_city: result.coDistrict || "--",
      corr_state: result.coState || "--",
      corr_pin: result.coPinCode || "--",

      perm_address: result.peAddress || "--",
      perm_city: result.peDistrict || "--",
      perm_state: result.peState || "--",
      perm_pin: result.pePinCode || "--",

      // Professional Info
      college: education.collegeName || education.CollegeName || "--",
      subject: result.subjectName || education.subjectName || "--",
      department: education.departmentName || education.deptName || result.subjectName || education.subjectName || "--",
      est_year: education.DeptEst || education.deptEst || education.estYear || "--",
      designation: result.designationName || "--",
      dor: result.retirementDate || "--",
      res_exp: education.researchExp || education.ResearchExp || "--",
      res_act: education.description || education.Description || "--",

      // PhD Details
      university: education.universityName || education.UniversityName || "--",
      decipline: education.phdSubject || education.PhdSubject || "--",
      sup_name: education.supervisorName || education.SupervisorName || "--",
      spl_area: education.areaOfSpec || education.AreaOfSpec || "--",
      thesis: education.thesisTitle || education.ThesisTitle || "--",
      duration: education.monthAndYear || education.MonthAndYear || "--",

      // Experience Details
      experience: result.experience?.map(exp => ({
        id: exp.id,
        organizationName: exp.organizationName || exp.OrganizationName || "--",
        designation: exp.designation || exp.Designation || "--",
        category: exp.category || exp.Category || "--",
        dateFrom: exp.dateFrom || exp.DateFrom || "--",
        dateTo: exp.dateTo || exp.DateTo || null,
        resExperience: exp.resExperience || exp.ResExperience || "--",
        areaOfSpec: exp.areaOfSpec || exp.AreaOfSpec || "--",
        doc: exp.doc || exp.Doc || null
      })) || [],

      // Publications - map research array
      publications: result.research?.map(paper => ({
        title: paper.titleOfPaper || paper.TitleOfPaper || "--",
        year: paper.pubYear || paper.PubYear || "--",
        journal: paper.journalName || paper.JournalName || "--",
        author: paper.authorName || paper.AuthorName || "--",
        issno: paper.issNo || paper.IssNo || "--",
        volume: paper.volume || paper.Volume || "--",
        page: paper.page?.toString() || paper.Page?.toString() || "--",
        category: paper.listedIn || paper.ListedIn || "--",
        ugcno: paper.ugcListNo || paper.UGCListNo || "--",
        citations: paper.citations || paper.Citations || "--",
        impact: paper.impactFactor || paper.ImpactFactor || "--",
        url: paper.webUrl || paper.WebUrl || "#",
        file_name: paper.uploadPaper || paper.UploadPaper || null
      })) || [],

      // Transaction
      txn_id: result.transaction?.txnNo || result.transaction?.TxnNo || "--",
      txn_amt: result.transaction?.totalFee || result.transaction?.TotalFee || "0.00",
      payment_date: result.transaction?.txnDate || result.transaction?.TxnDate || "--",

      // Files
      photo: result.supUploads?.photo || result.supUploads?.Photo || "photo.jpg",
      sign: result.supUploads?.sign || result.supUploads?.Sign || "signature.jpg",
      exp_cert: result.supUploads?.teachExp || result.supUploads?.TeachExp || "experience.pdf",
      appt_letter: result.supUploads?.appLetter || result.supUploads?.AppLetter || "appointment.pdf",

      // Additional fields
      supId: result.supId || "--",

      // Status fields
      appl_status: result.transaction ? "PAID" : "UNPAID",
      isAccepted: result.isAccepted || 0,
      rejectionReason: result.rejectionReason || "",
      scr1_st: "",
      scr1_remark: "",
      scr2_st: "",
      scr_lock: "N",
      review_st: "Open",
      review_remark: "",
      review_at: "",
      reviewed_by: "",
      reviewed_at: ""
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

  const getStepID = (role) => {
    switch (role) {
      case "16": return 21;
      case "18": return 22;
      case "3": return 23;
      case "8": return 24;
      case "4": return 25;
      case "21":
      case "2": return 26;
      default: return 0;
    }
  };

  const isScreeningLocked = () => {
    // Check if workflow instance is locked (rejected twice)
    if (workflowInstance?.isLocked) {
      return true;
    }
    
    const type = 4; // Dean is Step 4

    // If workflow has already progressed beyond Dean or is already approved
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
      return screeningData.screening4Status === 1 || (screeningData.screening4Status === 2 && screeningData.screening4Count >= 2);
    }

    return false;
  };

  const handleSubmit = async () => {
    if (!screeningStatus) {
      notification().error("Please select screening status");
      return;
    }
    if (screeningStatus === "Rejected" && !remarks.trim()) {
      notification().error("Remarks are required for Rejected status");
      return;
    }

    const confirmed = await confirm({
      title: "Confirm Submission",
      message: "Are you sure you want to submit the approval status?"
    });

    if (confirmed) {
      setSubmitting(true);
      try {
        const actionRequest = {
          instanceId: workflowInstance?.instanceID || workflowInstance?.instanceId || 0,
          entityId: parseInt(id),
          entityType: "Supervisor",
          action: screeningStatus === "Approved" ? "Approve" : "Reject",
          comments: remarks,
          userId: user?.id,
          workflowName: "Supervisor Registration"
        };

        await workflowService.submitApprovalAction(actionRequest);
        notification().success("Status updated successfully");

        await fetchScreeningDetails();
        navigate(returnPath.includes('?') ? returnPath : `${returnPath}?status=${previousStatus}`);
      } catch (error) {
        console.error("Error updating screening:", error);
        notification().error("Failed to update screening status");
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
      @page {
        size: A4;
        margin: 8mm;
      }
      @page:blank {
        display: none !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-weight: 400 !important;
        font-size: 8pt !important;
        line-height: 1.15 !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-weight: 400 !important;
        line-height: 1.15 !important;
      }
      /* Default font size for most elements */
      table, td, th, p, span {
        font-size: 8pt !important;
      }
      /* Keep headers bold, values normal weight */
      td[style*="fontWeight: 'bold'"],
      td[style*="font-weight: bold"],
      td b,
      td strong {
        font-weight: bold !important;
      }
      /* Ensure non-bold cells stay normal */
      td:not([style*="fontWeight"]):not([style*="font-weight"]) {
        font-weight: 400 !important;
      }
      .no-print {
        display: none !important;
      }
      .print-wrapper {
        padding: 0 !important;
        background: white !important;
        margin: 0 !important;
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
      }
      .print-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 8mm !important;
        padding-bottom: 0 !important;
        background: white !important;
        height: auto !important;
        box-shadow: none !important;
        overflow: visible !important;
      }
      /* Remove extra spacing at the end */
      .print-container > div:last-child {
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
      /* Allow content to flow across multiple pages */
      table {
        page-break-inside: auto !important;
        break-inside: auto !important;
        border-collapse: collapse !important;
        border: 1px solid #000 !important;
        font-size: 8pt !important;
        line-height: 1.15 !important;
      }
      tr {
        page-break-inside: avoid !important;
        page-break-after: auto !important;
        break-inside: avoid !important;
        break-after: auto !important;
      }
      td, th {
        border: 1px solid #000 !important;
        padding: 3pt !important;
        font-size: 8pt !important;
        line-height: 1.15 !important;
      }
      thead {
        display: table-header-group !important;
      }
      tbody {
        display: table-row-group !important;
      }
      /* Prevent page breaks in section containers */
      div[style*="marginTop: 20px"] {
        page-break-inside: auto !important;
        break-inside: auto !important;
        page-break-before: auto !important;
        break-before: auto !important;
      }
      /* Allow large sections to break across pages naturally */
      div[style*="marginTop: 20px"][style*="marginBottom: 16px"] {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Research Activities section - allow natural page break */
      div[style*="marginTop: 20px"][style*="marginBottom: 18px"] {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Prevent orphan pages */
      body::after {
        content: none !important;
      }
      html, body {
        height: auto !important;
        overflow: visible !important;
      }
      /* Keep section headers with their content */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        font-size: 9pt !important;
        margin-bottom: 3pt !important;
        line-height: 1.15 !important;
      }
      /* Section containers */
      .print-section {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Ensure section borders print */
      div[style*="border"] {
        border: 1px solid #000 !important;
        margin-bottom: 8pt !important;
      }
      /* Reduce image sizes for print */
      img {
        max-width: 70% !important;
        height: auto !important;
      }
      /* Logo in header - keep centered */
      img[alt="Logo"] {
        width: 45pt !important;
        height: auto !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      /* Photo and signature images - smaller for print and centered */
      img[alt="Photo"] {
        width: 60pt !important;
        height: 75pt !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      img[alt="Signature"] {
        width: 70pt !important;
        height: 28pt !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      /* Compact header */
      .print-container > div:first-child table td {
        padding: 5pt !important;
      }
      /* Header titles - keep larger sizes */
      .print-container > div:first-child table td > div {
        font-size: inherit !important;
      }
      /* Section titles */
      div[style*="textTransform"] {
        font-size: 8pt !important;
        margin-bottom: 2pt !important;
        margin-top: 8pt !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        orphans: 3 !important;
        widows: 3 !important;
      }
      /* Keep section title with its content */
      div[style*="textTransform"] + div {
        page-break-before: avoid !important;
        break-before: avoid !important;
        orphans: 3 !important;
        widows: 3 !important;
      }
      /* Ensure tables can break across pages */
      table {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Allow table rows to break naturally */
      tbody tr {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
    }
    @media screen {
      .print-container {
        width: 280mm;
        margin: 0 auto;
      }
      /* Center all images in preview mode */
      img[alt="Logo"],
      img[alt="Photo"],
      img[alt="Signature"] {
        display: block;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `;

  return (
    <>
      <style>{printStyles}</style>
      <div className="print-wrapper" style={{ padding: "24px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
        <div className="print-container" style={{ maxWidth: "280mm", margin: "0 auto", backgroundColor: "white", padding: "10mm" }}>
          <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }} className="no-print">
            <Button module="vc_supervisor_approval" action="read" icon={<ArrowLeftOutlined />} label="Back to Applications" variant="outline" onClick={handleBack} />
            <Button module="vc_supervisor_approval" action="read" icon={<PrinterOutlined />} label="Print" variant="outline" onClick={handlePrint} />
          </div>

          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "0" }}>
            <div className="hidden sm:flex justify-center mt-3 mb-0"><PrintHeader /></div>
          </div>

          {/* Basic Information */}
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderTop: "none",
              marginBottom: "16px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "11pt",
              }}
            >
              <tbody>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      width: "25%",
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    Registration No.
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc", width: "50%" }}>
                    {application.user_id}
                  </td>
                  <td
                    style={{
                      width: "25%",
                      textAlign: "center",
                      verticalAlign: "top",
                      padding: "10pt",
                      rowSpan: "6",
                      backgroundColor: "#ffffff",
                      borderLeft: "1px solid #ccc",
                    }}
                    rowSpan="6"
                  >
                    <div style={{ marginBottom: "12pt" }}>
                      <div style={{ fontSize: "8pt", fontWeight: "600", marginBottom: "6pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Photo
                      </div>
                      <img
                        src={getFilePath(application.photo)}
                        alt="Photo"
                        style={{
                          width: "85pt",
                          height: "105pt",
                          border: "1px solid #ccc",
                          objectFit: "cover",
                          display: "block",
                          margin: "0 auto",
                        }}
                      />
                    </div>
                    <div style={{ paddingTop: "10pt", padding: "10pt" }}>
                      <div style={{ fontSize: "8pt", fontWeight: "600", marginBottom: "6pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Signature
                      </div>
                      <img
                        src={getFilePath(application.sign)}
                        alt="Signature"
                        style={{
                          width: "85pt",
                          height: "35pt",
                          objectFit: "contain",
                          padding: "2pt",
                          display: "block",
                          margin: "0 auto",
                          backgroundColor: "#fafafa",
                        }}
                      />
                    </div>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    University
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc" }}>
                    {application.university}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    College
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc" }}>
                    {application.college}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    Department & Estb. Year
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc" }}>
                    {application.department} ({application.est_year})
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    Designation
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc" }}>
                    {application.designation}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "600",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                    }}
                  >
                    Research Experience
                  </td>
                  <td style={{ padding: "8pt 10pt", borderRight: "1px solid #ccc" }}>
                    {application.res_exp} Years
                  </td>
                </tr>
                {application.txn_amt !== "--" && parseFloat(application.txn_amt) > 0 && (
                  <tr>
                    <td
                      style={{
                        padding: "8pt 10pt",
                        fontWeight: "600",
                        borderRight: "1px solid #ccc",
                        backgroundColor: "#f8f9fa",
                        color: "#333",
                      }}
                    >
                      Payment Details
                    </td>
                    <td style={{ padding: "8pt 10pt" }} colSpan="2">
                      <b>Txn Id :</b> {application.txn_id} &nbsp;&nbsp;&nbsp;
                      <b>Amount (₹) :</b>{" "}
                      {application.txn_amt !== "--" ? parseFloat(application.txn_amt).toFixed(2) : "--"}{" "}
                      &nbsp;&nbsp;&nbsp;
                      <b>Txn Date:</b>{" "}
                      {application.payment_date !== "--" ? new Date(application.payment_date).toLocaleString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        }
                      ) : "--"}
                    </td>
                  </tr>
                )}
                {(application.txn_amt === "--" || parseFloat(application.txn_amt) === 0) && (
                  <tr>
                    <td
                      style={{
                        padding: "8pt 10pt",
                        fontWeight: "600",
                        borderRight: "1px solid #ccc",
                        backgroundColor: "#f8f9fa",
                        color: "#333",
                      }}
                    >
                      Payment Details
                    </td>
                    <td style={{ padding: "8pt 10pt" }} colSpan="2">
                      <b style={{ color: "#16a34a" }}>Fees Exempted</b>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Personal Details */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }} className="print-section">PERSONAL DETAILS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }} className="print-section">
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
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }} className="print-section">DETAILS OF PH.D.</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }} className="print-section">
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
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }} className="print-section">EXPERIENCE DETAILS</div>
          {application.experience && application.experience.length > 0 ? (
            <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }} className="print-section">
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
              <div
                style={{
                  marginTop: "20px",
                  marginBottom: "6pt",
                  fontWeight: "bold",
                  fontSize: "11pt",
                  textTransform: "uppercase",
                  textAlign: "left",
                }}
                className="print-section"
              >
                RESEARCH ACTIVITIES
              </div>
              <div
                style={{
                  backgroundColor: "white",
                  border: "1px solid #000",
                  padding: "8pt",
                  marginBottom: "18px",
                  lineHeight: "1.4",
                  fontSize: "9pt",
                }}
                className="print-section"
              >
                {application.res_act}
              </div>
            </>
          )}

          {/* Research Papers */}
          <div style={{ marginTop: "20px", marginBottom: "6pt", fontWeight: "bold", fontSize: "11pt", textTransform: "uppercase", textAlign: "left" }} className="print-section">RESEARCH PAPERS</div>
          <div style={{ backgroundColor: "white", border: "1px solid #000", marginBottom: "16px" }} className="print-section">
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
                        {pub.file_name && (<>, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href={getFilePath(pub.file_nam)} target="_blank" rel="noreferrer" style={{ color: "#0066cc", textDecoration: "underline" }}><b>Attached Paper</b></a></>)}
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
          <div style={{ marginTop: "32px", backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }} className="no-print">
            <div style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "16px 20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "0", color: "#1f2937" }}>Screening Decision</h3>
            </div>
            <div style={{ padding: "20px" }}>
              {/* Current Screening Info */}
              {(screeningData || (Array.isArray(workflowHistory) && workflowHistory.length > 0)) && (
                <div style={{ padding: "12px 16px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
                  <div style={{ marginBottom: "8px", fontWeight: "600" }}>Current Screening Status:</div>
                  <div>
                    <strong>Screening 1 (Supervisor Cell):</strong>
                    {(() => {
                      const step1Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 1) : null;
                      if (step1Log) {
                        return step1Log.action === "Approve" ? " ✓ Provisional Accepted" : " ✗ Rejected";
                      }
                      return screeningData?.screening1Status === 1 ? " Provisional Accepted" : screeningData?.screening1Status === 2 ? " Rejected" : " Pending";
                    })()}
                    {screeningData?.screening1Count >= 2 && " (Final)"}
                  </div>
                  <div>
                    <strong>Screening 2 (Deputy Registrar):</strong>
                    {(() => {
                      const step2Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 2) : null;
                      if (step2Log) {
                        return step2Log.action === "Approve" ? " ✓ Accepted" : " ✗ Rejected";
                      }
                      return screeningData?.screening2Status === 1 ? " Accepted" : screeningData?.screening2Status === 2 ? " Rejected" : " Pending";
                    })()}
                    {screeningData?.screening2Count >= 2 && " (Final)"}
                  </div>
                  <div>
                    <strong>Screening 3 (Registrar):</strong>
                    {(() => {
                      const step3Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 3) : null;
                      if (step3Log) {
                        return step3Log.action === "Approve" ? " ✓ Forwarded" : " ✗ Rejected";
                      }
                      return screeningData?.screening3Status === 1 ? " Forwarded" : screeningData?.screening3Status === 2 ? " Rejected" : " Pending";
                    })()}
                    {screeningData?.screening3Count >= 2 && " (Final)"}
                  </div>
                  <div>
                    <strong>Screening 4 (Dean):</strong>
                    {(() => {
                      const step4Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 4) : null;
                      if (step4Log) {
                        return step4Log.action === "Approve" ? " ✓ Approved" : " ✗ Rejected";
                      }
                      return screeningData?.screening4Status === 1 ? " Approved" : screeningData?.screening4Status === 2 ? " Rejected" : " Pending";
                    })()}
                    {screeningData?.screening4Count >= 2 && " (Final)"}
                  </div>
                </div>
              )}

              {/* Locked Message */}
              {currentScreeningLocked && (() => {
                // Check workflow history for Dean's step (Step 4)
                const deanStepLog = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 4) : null;
                const isApproved = deanStepLog?.action === "Approve" || workflowInstance?.currentStepOrder > 4 || workflowInstance?.status === "Approved";
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
                      ? "Dean approval completed - Application forwarded to DOR" 
                      : isLocked 
                        ? "Application rejected twice - status locked" 
                        : "Dean approval completed"}
                  </div>
                );
              })()}

              {/* Status Selection */}
              {!currentScreeningLocked && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                      Dean Office Screening Status:
                    </label>
                    <div style={{ display: "flex", gap: "20px" }}>
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
                      placeholder="Enter remarks for Screening 4 (Dean Office)..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                      style={{ borderRadius: "6px", fontSize: "14px" }}
                    />
                  </div>

                  {/* Action Button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                    <Button
                      type='primary'
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={submitting || currentScreeningLocked}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md border-0"
                    >
                      {submitting ? 'Submitting...' : 'Send To DOR'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorStageIV;
