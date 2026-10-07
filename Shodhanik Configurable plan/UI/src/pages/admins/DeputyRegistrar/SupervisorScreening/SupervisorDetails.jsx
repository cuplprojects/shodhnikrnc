import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { fetchSupervisorPersonalDetails, fetchScreeningData, createOrUpdateScreening } from "@/services/supervisorRecognitionCellService";
import workflowService from "@/services/workflowService";
import { getFilePath } from "@/utils/fileUtils";
import { Button } from 'antd';
import { confirm } from '@/services/ConfirmationService';
import PrintHeader from '@/components/cms/PrintHeader';
import notification from '@/services/NotificationService';
import useStaffAuthStore from '@/store/staffAuthStore';
import { hasPermission } from '@/services/hasPermissionService';


// Permissions will be checked inside the component

// Custom components to replace Ant Design
const Spin = ({ size = "default", children }) => {
  const sizeMap = {
    small: "w-4 h-4",
    default: "w-8 h-8",
    large: "w-12 h-12"
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeMap[size]} border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin`}></div>
      {children}
    </div>
  );
};

const Radio = ({ value, checked, onChange, children, style }) => (
  <label className="flex items-center gap-2 cursor-pointer" style={style}>
    <input
      type="radio"
      name="screening-status-radio-group" // Updated name for consistency
      value={value}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 text-slate-600 border-gray-300 focus:ring-slate-500"
    />
    <span>{children}</span>
  </label>
);

const RadioGroup = ({ value, onChange, children, style }) => {
  const handleChange = (e) => {
    onChange({ target: { value: e.target.value } });
  };

  return (
    <div style={style}>
      {React.Children.map(children, child =>
        React.cloneElement(child, {
          checked: child.props.value === value,
          onChange: handleChange,
          name: "screening-status-radio-group" // Updated name for consistency
        })
      )}
    </div>
  );
};

Radio.Group = RadioGroup;

const TextArea = ({ rows, value, onChange, placeholder, style }) => (
  <textarea
    rows={rows}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={style}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
  />
);

const message = {
  success: (text) => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  },
  error: (text) => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  }
};

const Modal = {
  confirm: async ({ title, content, onOk }) => {
    const confirmed = await confirm({
      title: title,
      message: content
    });
    if (confirmed && onOk) {
      onOk();
    }
  }
};

// Icons as SVG components
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

const SupervisorDetailsStageII = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [screeningType, setScreeningType] = useState(1); // 1 for Screening 1, 2 for Screening 2
  const [screeningStatus, setScreeningStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check permissions inside component
  const canupdate = hasPermission('deputyregistrar_supervisor_applications.update');
  const canread = hasPermission('deputyregistrar_supervisor_applications.read');

  const previousStatus = location.state?.status || "all";
  const returnPath = location.state?.returnPath || `/dR-supervisor-consent`;

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
      const history = historyResponse.logs || historyResponse; // Handle both old and new response format
      const instance = historyResponse.instance || null;
      
      setWorkflowHistory(Array.isArray(history) ? history : []);
      setWorkflowInstance(instance);

      // Deputy Registrar is Step 2 in configured supervisor workflow (WorkflowID 5)
      // Step 1 = Supervisor Cell / RAC (roleId 16)
      // Step 2 = Deputy Registrar (roleId 18)
      // Step 3 = Registrar (roleId 3)
      // Step 4 = Dean (roleId 8)
      // Step 5 = DOR / Director of Research (roleId 4)
      // Step 6 = VC Office (roleId 2 or 21)
      const type = 2;
      setScreeningType(type);

      // Try to get status from workflow history first
      const myStepLog = Array.isArray(history) ? history.find(l => l.stepOrder === type) : null;
      if (myStepLog) {
        // Use the workflow engine status
        setScreeningStatus(myStepLog.action === "Approve" ? "Eligible" : "Not Eligible");
        setRemarks(myStepLog.comments || "");
      } else {
        // No workflow history for this step yet
        setScreeningStatus("");
        setRemarks("");
        
        // Fallback to legacy screening data only if workflow history is completely empty
        if ((!history || history.length === 0) && screening) {
          const legacyStatus = screening[`screening${type}Status`];
          if (legacyStatus !== 0) {
            setScreeningStatus(legacyStatus === 1 ? "Eligible" : "Not Eligible");
            setRemarks(screening[`screening${type}Remark2`] || screening[`screening${type}Remark1`] || "");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching screening data:", error);
    }
  };

  // Helper function to map API response with fallbacks
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
      college: education.collegeName || "--",
      subject: result.subjectName || education.subjectName || "--",
      // subject_name: education.subject || "--",
      est_year: education.deptEst || "--",
      designation: result.designationName || "--",
      dor: result.retirementDate || "--",
      res_exp: education.researchExp || "--",
      res_act: education.description || "--",
      // PhD Details
      university: education.universityName || "--",
      decipline: education.phdSubject || "--",
      sup_name: education.supervisorName || "--",
      spl_area: education.areaOfSpec || "--",
      thesis: education.thesisTitle || "--",
      duration: education.monthAndYear || "--", // Not available in new API

      // Experience Details
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

      // Publications - map research array
      publications: result.research?.map(paper => ({
        title: paper.titleOfPaper || "--",
        year: paper.pubYear || "--",
        journal: paper.journalName || "--",
        author: paper.authorName || "--",
        issno: paper.issNo || "--",
        volume: paper.volume || "--",
        page: paper.page?.toString() || "--",
        category: paper.listedIn || "--",
        ugcno: paper.ugcListNo || "--",
        citations: paper.citations || "--",
        impact: paper.impactFactor || "--",
        url: paper.webUrl || "#",
        file_name: paper.uploadPaper || null
      })) || [],

      // Transaction
      txn_id: result.transaction?.txnNo || result.transaction?.TxnNo || "--",
      txn_amt: result.transaction?.totalFee || result.transaction?.TotalFee || "0.00",
      payment_date: result.transaction?.txnDate || result.transaction?.TxnDate || "--",

      // Files
      photo: result.supUploads?.photo || "photo.jpg",
      sign: result.supUploads?.sign || "signature.jpg",
      exp_cert: result.supUploads?.teachExp || "experience.pdf",
      appt_letter: result.supUploads?.appLetter || "appointment.pdf",

      // Additional fields
      supId: result.supId || "--",

      // Status fields
      appl_status: result.transaction ? "PAID" : "UNPAID",
      isAccepted: result.isAccepted || 0, // 0: unscreened, 1: accepted, 2: rejected, 3: re-verification rejected
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

      // Map the API response to the expected format
      const mappedData = mapApiResponse(result);
      setApplication(mappedData);
    } catch (error) {
      console.error("Error fetching application details:", error);
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (returnPath.includes('?')) {
      navigate(returnPath);
    } else {
      navigate(`${returnPath}?status=${previousStatus}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintPage = () => {
    navigate(`/supervisor-details-print/${id}`);
  };

  const isScreeningLocked = () => {
    // Check if workflow instance is locked (rejected twice)
    if (workflowInstance?.isLocked) {
      return true;
    }

    const type = 2; // Deputy Registrar is Step 2

    // If workflow has already progressed beyond Deputy Registrar or is already approved
    if (workflowInstance && (workflowInstance.currentStepOrder > type || workflowInstance.status === "Approved")) {
      return true;
    }
    
    // Check if current step is already approved in workflow history
    if (Array.isArray(workflowHistory) && workflowHistory.some(l => l.stepOrder === type && l.action === "Approve")) {
      return true;
    }

    if (workflowInstance?.currentStepOrder === type && workflowInstance?.currentStepRejectionCount >= 2) {
      return true;
    }
    
    if (!workflowInstance && screeningData) {
      return screeningData.screening2Status === 1 ||
        (screeningData.screening2Status === 2 && screeningData.screening2Count >= 2);
    }

    return false;
  };

  const handleSubmit = async () => {
    if (!screeningStatus) {
      notification().error("Please select screening status");
      return;
    }

    if (screeningStatus === "Not Eligible" && !remarks.trim()) {
      notification().error("Remarks are required for Not Eligible status");
      return;
    }

    // Check if screening is locked
    if (isScreeningLocked()) {
      notification().error("This screening step is already completed and locked.");
      return;
    }

    Modal.confirm({
      title: "Confirm Submission",
      content: "Are you sure you want to submit the Approval?",
      onOk: async () => {
        setSubmitting(true);
        try {
          const actionRequest = {
            entityId: parseInt(id),
            entityType: "Supervisor",
            action: screeningStatus === "Eligible" ? "Approve" : "Reject",
            comments: remarks,
            userId: user?.id,
            workflowName: "Supervisor Registration"
          };

          await workflowService.submitApprovalAction(actionRequest);
          notification().success("Approval submitted successfully");

          // Refresh screening data
          await fetchScreeningDetails();

          if (returnPath.includes('?')) {
            navigate(returnPath);
          } else {
            navigate(`${returnPath}?status=${previousStatus}`);
          }
        } catch (error) {
          console.error("Error submitting approval:", error);
          notification().error("Failed to submit approval");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const canDoScreening2 = screeningData?.screening1Status === 1; // Only if Screening 1 is accepted

  const getScreeningStatusDisplay = () => {
    if (!screeningData) return <span style={{ color: "#6b7280" }}>No screening data</span>;

    const screening1Status = screeningData.screening1Status;
    const screening1Count = screeningData.screening1Count;
    const screening2Status = screeningData.screening2Status;
    const screening2Count = screeningData.screening2Count;

    // Screening 1 status with colors
    let screening1Text = "";
    let screening1Color = "#6b7280"; // default gray

    if (screening1Status === 1) {
      screening1Text = screening1Count >= 2 ? "Screening 1: Final Provisional Accepted" : "Screening 1: Provisional Accepted";
      screening1Color = "#16a34a"; // green
    } else if (screening1Status === 2) {
      screening1Text = screening1Count >= 2 ? "Screening 1: Final Rejected" : "Screening 1: Rejected";
      screening1Color = "#dc2626"; // red
    } else {
      screening1Text = "Screening 1: Pending";
      screening1Color = "#d97706"; // orange
    }

    // Screening 2 status with colors
    let screening2Text = "";
    let screening2Color = "#6b7280"; // default gray

    if (screening2Status === 1) {
      screening2Text = screening2Count >= 2 ? "Screening 2: Final Accepted" : "Screening 2: Accepted";
      screening2Color = "#16a34a"; // green
    } else if (screening2Status === 2) {
      screening2Text = screening2Count >= 2 ? "Screening 2: Final Rejected" : "Screening 2: Rejected";
      screening2Color = "#dc2626"; // red
    } else {
      screening2Text = "Screening 2: Pending";
      screening2Color = "#d97706"; // orange
    }

    return (
      <span>
        <span style={{ color: screening1Color, fontWeight: "600" }}>{screening1Text}</span>
        <span style={{ color: "#6b7280", margin: "0 4px" }}> - Count: {screening1Count}</span>
        <br />
        <span style={{ color: screening2Color, fontWeight: "600" }}>{screening2Text}</span>
        <span style={{ color: "#6b7280", margin: "0 4px" }}> - Count: {screening2Count}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">Application not found</div>
      </div>
    );
  }

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
      /* Reduce spacing */
      div {
        page-break-inside: auto !important;
        break-inside: auto !important;
        margin-bottom: 8pt !important;
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
      <div
        className="print-wrapper"
        style={{
          padding: "24px",
          backgroundColor: "#f9fafb",
          minHeight: "100vh",
        }}
      >
        <div
          className="print-container"
          style={{
            maxWidth: "280mm",
            margin: "0 auto",
            backgroundColor: "white",
            padding: "10mm",
          }}
        >
          {/* Action Buttons - Hidden in print */}
          <div
            style={{ marginBottom: "16px", display: "flex", gap: "8px" }}
            className="no-print"
          >
            <Button
              module="supervisor_applications"
              action="read"
              icon={<ArrowLeftOutlined />}
              label="Back to Applications"
              variant="outline"
              onClick={handleBack}
            />
            <Button
              module="supervisor_applications"
              action="read"
              icon={<PrinterOutlined />}
              label="Print"
              variant="outline"
              onClick={handlePrint}
            />
          </div>

          {/* Application Header */}
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              marginBottom: "0",
            }}
          >
            <div className="hidden sm:flex justify-center mt-3 mb-0">
              <PrintHeader />
            </div>
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
                    {application.subject} ({application.est_year})
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
          <div
            style={{
              marginTop: "20px",
              marginBottom: "6pt",
              fontWeight: "bold",
              fontSize: "11pt",
              textTransform: "uppercase",
              textAlign: "left",
            }}
          >
            PERSONAL DETAILS
          </div>
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #000",
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
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      width: "110pt",
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Name
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.name}
                  </td>
                  <td
                    style={{
                      width: "110pt",
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Father's Name
                  </td>
                  <td style={{ padding: "6pt" }}>{application.fname}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Date of Birth
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.dob !== "--" ? new Date(application.dob).toLocaleDateString("en-GB") : "--"}
                  </td>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Age
                  </td>
                  <td style={{ padding: "6pt" }}>
                    {application.dob !== "--" ? Math.floor(
                      (new Date() - new Date(application.dob)) / 31557600000
                    ) + " years" : "--"}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Gender
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.gender}
                  </td>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Nationality
                  </td>
                  <td style={{ padding: "6pt" }}>
                    {application.nationality === "Other"
                      ? application.nationality_other
                      : application.nationality}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Identity Proof
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.id_type}
                  </td>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Identity Proof No.
                  </td>
                  <td style={{ padding: "6pt" }}>{application.id_no}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Mailing
                    <br />
                    Address
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.corr_address},{" "}
                    {application.corr_city?.toUpperCase()},{" "}
                    {application.corr_state?.toUpperCase()}, PIN-
                    {application.corr_pin}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Permanent
                    <br />
                    Address
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.perm_address},{" "}
                    {application.perm_city?.toUpperCase()},{" "}
                    {application.perm_state?.toUpperCase()}, PIN-
                    {application.perm_pin}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Mobile No.
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.mobile}
                  </td>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Email Id
                  </td>
                  <td style={{ padding: "6pt" }}>{application.email}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PhD Details */}
          <div
            style={{
              marginTop: "20px",
              marginBottom: "6pt",
              fontWeight: "bold",
              fontSize: "11pt",
              textTransform: "uppercase",
              textAlign: "left",
            }}
          >
            DETAILS OF PH.D.
          </div>
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #000",
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
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      width: "130pt",
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Name of
                    <br />
                    University
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.university}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Discipline
                  </td>
                  <td style={{ padding: "6pt", borderRight: "1px solid #000" }}>
                    {application.decipline}
                  </td>
                  <td
                    style={{
                      width: "80pt",
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Supervisor Name
                  </td>
                  <td style={{ padding: "6pt" }}>{application.sup_name}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Area of
                    <br />
                    Specialization
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.spl_area}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Title of Thesis
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.thesis}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "6pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #000",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    Awarded
                    <br />
                    (Year & Month)
                  </td>
                  <td style={{ padding: "6pt" }} colSpan="3">
                    {application.duration}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Experience Details */}
          <div
            style={{
              marginTop: "20px",
              marginBottom: "6pt",
              fontWeight: "bold",
              fontSize: "11pt",
              textTransform: "uppercase",
              textAlign: "left",
            }}
          >
            EXPERIENCE DETAILS
          </div>
          {application.experience && application.experience.length > 0 ? (
            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #000",
                marginBottom: "16px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "9pt",
                }}
              >
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
            <div
              style={{
                backgroundColor: "white",
                border: "1px solid #000",
                padding: "8pt",
                marginBottom: "16px",
                fontSize: "9pt",
                color: "#666",
              }}
            >
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
              >
                {application.res_act}
              </div>
            </>
          )}

          {/* Research Papers */}
          <div
            style={{
              marginTop: "20px",
              marginBottom: "6pt",
              fontWeight: "bold",
              fontSize: "11pt",
              textTransform: "uppercase",
              textAlign: "left",
            }}
          >
            RESEARCH PAPERS
          </div>
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #000",
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
              <thead style={{ display: "table-header-group" }}>
                <tr
                  style={{
                    borderBottom: "1px solid #000",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  <th
                    style={{
                      width: "30pt",
                      padding: "6pt",
                      borderRight: "1px solid #000",
                      textAlign: "center",
                      fontWeight: "bold",
                      verticalAlign: "middle",
                    }}
                  >
                    Sr. No.
                  </th>
                  <th
                    style={{
                      width: "120pt",
                      padding: "6pt",
                      borderRight: "1px solid #000",
                      textAlign: "center",
                      fontWeight: "bold",
                      verticalAlign: "middle",
                    }}
                  >
                    Title of Paper
                  </th>
                  <th
                    style={{
                      padding: "6pt",
                      textAlign: "center",
                      fontWeight: "bold",
                      verticalAlign: "middle",
                    }}
                  >
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {application.publications &&
                  application.publications.length > 0 ? (
                  application.publications.map((pub, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom:
                          index === application.publications.length - 1
                            ? "none"
                            : "1px solid #000",
                      }}
                    >
                      <td
                        style={{
                          padding: "6pt",
                          borderRight: "1px solid #000",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: "6pt",
                          borderRight: "1px solid #000",
                          verticalAlign: "middle",
                          lineHeight: "1.3",
                        }}
                      >
                        {pub.title}
                      </td>
                      <td
                        style={{
                          padding: "6pt",
                          lineHeight: "1.5",
                          verticalAlign: "middle",
                        }}
                      >
                        <b>Year of Publication:</b> {pub.year},
                        &nbsp;&nbsp;&nbsp;
                        <b>Name of Journal:</b> {pub.journal}
                        <br />
                        <b>Author(s):</b> {pub.author}
                        <br />
                        <b>ISSN No.:</b> {pub.issno}, &nbsp;&nbsp;&nbsp;
                        <b>Volume:</b> {pub.volume}, &nbsp;&nbsp;&nbsp;
                        <b>Page No.:</b> {pub.page}
                        <br />
                        <b>Listed In:</b> {pub.category}, &nbsp;&nbsp;&nbsp;
                        <b>UGC List No.:</b> {pub.ugcno}
                        <br />
                        <b>Citations:</b> {pub.citations},
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <b>Impact Factor:</b> {pub.impact}
                        <br />
                        <b>Web URL:</b>{" "}
                        <a
                          href={
                            pub.url.startsWith("www.")
                              ? `http://${pub.url}`
                              : pub.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#0066cc",
                            textDecoration: "underline",
                          }}
                        >
                          Click Here
                        </a>
                        {pub.file_name && (
                          <>
                            , &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                            <a
                              href={getFilePath(pub.file_name)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#0066cc",
                                textDecoration: "underline",
                              }}
                            >
                              <b>Attached Paper</b>
                            </a>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      style={{
                        padding: "12pt",
                        textAlign: "center",
                        color: "#666",
                      }}
                    >
                      No publications available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Review Section */}
          {application.review_st && application.review_st !== "Open" && (
            <div style={{ marginTop: "30px", marginBottom: "16px" }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "15pt",
                  textTransform: "uppercase",
                  color: "green",
                  marginBottom: "8px",
                  textAlign: "left",
                }}
              >
                Review Applied by Applicant
              </div>
              <div
                style={{ backgroundColor: "white", border: "1px solid #000" }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    lineHeight: "26pt",
                  }}
                >
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                      <td
                        style={{
                          width: "150pt",
                          padding: "3pt",
                          fontWeight: "bold",
                          verticalAlign: "top",
                          borderRight: "1px solid #000",
                        }}
                      >
                        Comments/Remarks:
                      </td>
                      <td style={{ padding: "3pt", lineHeight: "12pt" }}>
                        {application.review_remark}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                      <td style={{ padding: "3pt", fontWeight: "bold", borderRight: "1px solid #000" }}>
                        Applied At:
                      </td>
                      <td style={{ padding: "3pt" }}>
                        {application.review_at !== "--" && application.review_at ? new Date(application.review_at).toLocaleString(
                          "en-GB"
                        ) : "--"}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                      <td style={{ padding: "3pt", fontWeight: "bold", borderRight: "1px solid #000" }}>
                        Review Status:
                      </td>
                      <td style={{ padding: "3pt" }}>
                        {application.review_st}
                      </td>
                    </tr>
                    {application.reviewed_by && (
                      <tr>
                        <td style={{ padding: "3pt", fontWeight: "bold", borderRight: "1px solid #000" }}>
                          Reviewed By:
                        </td>
                        <td style={{ padding: "3pt" }}>
                          {application.reviewed_by} Date:{" "}
                          {application.reviewed_at !== "--" && application.reviewed_at ? new Date(application.reviewed_at).toLocaleString(
                            "en-GB"
                          ) : "--"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Two-Step Screening Section - Hidden in print */}
          <div
            style={{
              marginTop: "32px",
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
            className="no-print"
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e5e7eb",
                padding: "16px 20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  margin: "0",
                  color: "#1f2937",
                }}
              >
                Screening Decision
              </h3>
            </div>

            {/* Content */}
            <div style={{ padding: "20px" }}>
              {/* Current Screening Info */}
              {screeningData && (
                <div style={{
                  padding: "12px 16px",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "13px"
                }}>
                  <div style={{ marginBottom: "8px", fontWeight: "600" }}>Current Screening Status:</div>
                  <div>
                    <strong>Screening 1 (Supervisor Cell):</strong>
                    {(() => {
                      const step1Log = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 1) : null;
                      if (step1Log) {
                        return step1Log.action === "Approve" ? " ✓ Provisional Accepted" : " ✗ Rejected";
                      }
                      return screeningData.screening1Status === 1 ? " Provisional Accepted" :
                        screeningData.screening1Status === 2 ? " Rejected" : " Pending";
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
                      return screeningData.screening2Status === 1 ? " Accepted" :
                        screeningData.screening2Status === 2 ? " Rejected" : " Pending";
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
                      return screeningData.screening3Status === 1 ? " Approved" :
                        screeningData.screening3Status === 2 ? " Rejected" : " Pending";
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
                      return screeningData.screening4Status === 1 ? " Approved" :
                        screeningData.screening4Status === 2 ? " Rejected" : " Pending";
                    })()}
                    {screeningData.screening4Count >= 2 && " (Final)"}
                  </div>
                </div>
              )}

              {/* Locked Message */}
              {currentScreeningLocked && (() => {
                // Check workflow history for Deputy Registrar's step (Step 4)
                const deputyRegistrarStepLog = Array.isArray(workflowHistory) ? workflowHistory.find(l => l.stepOrder === 4) : null;
                const isApproved = deputyRegistrarStepLog?.action === "Approve";
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
                      ? "Deputy Registrar approval completed - Application forwarded to Registrar" 
                      : isLocked 
                        ? "Application rejected twice - status locked" 
                        : "Deputy Registrar approval completed"}
                  </div>
                );
              })()}

              {/* Status Selection */}
              {!currentScreeningLocked && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#374151",
                      }}
                    >
                      {screeningType === 1 ? 'Screening 1' : 'Screening 2'} Status:
                    </label>
                    <Radio.Group
                      value={screeningStatus}
                      onChange={(e) => setScreeningStatus(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      <div style={{ display: "flex", gap: "20px" }}>
                        <Radio
                          value="Eligible"
                          style={{ fontSize: "14px" }}
                        >
                          <span style={{ color: "#16a34a", fontWeight: "500" }}>
                            ✓ {screeningType === 1 ? 'Provisional Accepted' : 'Final Accepted'}
                          </span>
                        </Radio>
                        <Radio
                          value="Not Eligible"
                          style={{ fontSize: "14px" }}
                        >
                          <span style={{ color: "#dc2626", fontWeight: "500" }}>
                            ✗ {screeningType === 1 ? 'Rejected' : 'Final Rejected'}
                          </span>
                        </Radio>
                      </div>
                    </Radio.Group>
                  </div>

                  {/* Remarks Section */}
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#374151",
                      }}
                    >
                      Remarks:
                      {screeningStatus === "Not Eligible" && (
                        <span style={{ color: "#dc2626", marginLeft: "4px" }}>*</span>
                      )}
                    </label>
                    <TextArea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder={`Enter remarks for ${screeningType === 1 ? 'Screening 1' : 'Screening 2'}...`}
                      style={{
                        borderRadius: "6px",
                        fontSize: "14px"
                      }}
                    />
                  </div>

                  {/* Action Button */}
                  <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    paddingTop: "12px",
                    borderTop: "1px solid #e5e7eb"
                  }}>
                    {(canread && canupdate) && (
                      <Button
                        // module="supervisor_applications"
                        // action="approve"
                        label={`Submit ${screeningType === 1 ? 'Screening 1' : 'Screening 2'}`}
                        // variant="solid"
                        size="md"
                        onClick={handleSubmit}
                        loading={submitting}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md border-0"
                        type="primary"
                      >Submit</Button>
                    )}

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

export default SupervisorDetailsStageII;
