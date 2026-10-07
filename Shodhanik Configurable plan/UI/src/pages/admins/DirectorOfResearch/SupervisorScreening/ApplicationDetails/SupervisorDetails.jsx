import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { fetchSupervisorPersonalDetails, fetchScreeningData, createOrUpdateScreening } from "@/services/supervisorRecognitionCellService";
import workflowService from "@/services/workflowService";
import { getFilePath } from "@/utils/fileUtils";
import Button from '@/components/ui/Button';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import PrintHeader from '@/components/cms/PrintHeader';
import useStaffAuthStore from '@/store/staffAuthStore';
import { getStepOrderForRole, isStepLocked, parseWorkflowHistoryResponse } from '@/utils/workflowStepMapper';

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

const SupervisorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [screeningData, setScreeningData] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [screeningType, setScreeningType] = useState(5); // 1 for Screening 1, 2 for Screening 2
  const [screeningStatus, setScreeningStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const previousStatus = location.state?.status || "all";
  const returnPath = location.state?.returnPath || `/dor/supervisor-screening`;

  useEffect(() => {
    fetchSupervisorDetails();
    fetchScreeningDetails();
  }, [id]);

  const fetchScreeningDetails = async () => {
    try {
      // Fetch legacy screening data (for backward compatibility if needed)
      const screening = await fetchScreeningData(id);
      setScreeningData(screening);

      // Fetch new workflow history and instance
      const historyResponse = await workflowService.getEntityHistory("Supervisor", id);
      const { logs: history, instance } = parseWorkflowHistoryResponse(historyResponse);
      
      setWorkflowHistory(history);
      setWorkflowInstance(instance);

      const roleId = user?.roleID || user?.roleId;
      
      // DOR is Step 5 in Supervisor workflow
      const type = 5;
      setScreeningType(type);

      // Try to get status from workflow history first
      const stepLog = history.find(l => l.stepOrder === type);
      if (stepLog) {
        // Use the workflow engine status
        setScreeningStatus(stepLog.action === "Approve" ? "Eligible" : "Not Eligible");
        setRemarks(stepLog.comments || "");
      } else {
        // No workflow history for this step yet, check if it's pending
        // If there's no log entry, it means this step hasn't been processed yet
        setScreeningStatus("");
        setRemarks("");
        
        // Fallback to legacy screening data only if workflow history is completely empty
        if (history.length === 0 && screening && screening[`screening${type}Status`] !== 0) {
          const status = screening[`screening${type}Status`] === 1 ? "Eligible" : "Not Eligible";
          setScreeningStatus(status);
          setRemarks(screening[`screening${type}Remark2`] || screening[`screening${type}Remark1`] || "");
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
      subject: education.subjectName || result.subjectName || "--",
      est_year: education.deptEst || "--",
      designation: result.designationName || "--",
      dor: result.retirementDate || "--",
      res_exp: education.researchExp || "--",

      // PhD Details
      university: education.universityName || "--",
      decipline: education.phdSubject || "--",
      sup_name: education.supervisorName || "--",
      spl_area: education.areaOfSpec || "--",
      thesis: education.thesisTitle || "--",
      duration: education.monthAndYear || "--", // Not available in new API
      // Research Activities
      res_act: education.description || "--",

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
      content: `Are you sure you want to submit the Approval?`,
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

          notification().success(`Approval submitted successfully`);

          // Refresh details to show updated history
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

  const isScreeningLocked = () => {
    return isStepLocked({
      stepOrder: screeningType,
      workflowHistory: workflowHistory,
      isLocked: workflowInstance?.isLocked || false,
      legacyScreeningData: screeningData
    });
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
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-weight: 400 !important;
        font-size: 9pt !important;
        line-height: 1.4 !important;
        color: #000 !important;
      }
      html, body {
        height: auto !important;
        overflow: visible !important;
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
        background: white !important;
        height: auto !important;
        box-shadow: none !important;
        overflow: visible !important;
      }
      /* All divs maintain styling */
      div {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Keep research activities together */
      div[style*="backgroundColor: \"white\""][style*="border"] {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: auto !important;
        orphans: 1 !important;
        widows: 1 !important;
      }
      /* Preserve all backgrounds and borders */
      div[style*="backgroundColor"],
      div[style*="background-color"] {
        background-color: inherit !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      div[style*="border"] {
        border: 1px solid #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      /* Tables */
      table {
        page-break-inside: auto !important;
        break-inside: auto !important;
        border-collapse: collapse !important;
        border: 1px solid #000 !important;
        font-size: 9pt !important;
        line-height: 1.4 !important;
        width: 100% !important;
        background-color: white !important;
      }
      tr {
        page-break-inside: avoid !important;
        page-break-after: auto !important;
        break-inside: avoid !important;
        break-after: auto !important;
      }
      td, th {
        border: 1px solid #000 !important;
        padding: 6pt !important;
        font-size: 9pt !important;
        line-height: 1.4 !important;
        background-color: white !important;
      }
      thead {
        display: table-header-group !important;
      }
      tbody {
        display: table-row-group !important;
      }
      /* Text styling */
      table, td, th, p, span {
        font-size: 9pt !important;
        line-height: 1.4 !important;
      }
      td[style*="fontWeight: 'bold'"],
      td[style*="font-weight: bold"],
      td b,
      td strong {
        font-weight: bold !important;
      }
      td:not([style*="fontWeight"]):not([style*="font-weight"]) {
        font-weight: 400 !important;
      }
      /* Section headers */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        font-size: 10pt !important;
        margin-bottom: 6pt !important;
        line-height: 1.4 !important;
        font-weight: bold !important;
      }
      /* Section titles with uppercase */
      div[style*="textTransform"] {
        font-size: 10pt !important;
        margin-bottom: 6pt !important;
        margin-top: 12pt !important;
        font-weight: bold !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      /* Images */
      img {
        max-width: 100% !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      img[alt="Logo"] {
        width: 45pt !important;
        height: auto !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      img[alt="Photo"] {
        width: 55pt !important;
        height: 70pt !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
        border: 1px solid #000 !important;
      }
      img[alt="Signature"] {
        width: 75pt !important;
        height: 32pt !important;
        display: block !important;
        margin-left: auto !important;
        margin-right: auto !important;
        border: 1px solid #000 !important;
      }
      /* Preserve all inline styles */
      [style*="backgroundColor: \"white\""],
      [style*="background-color: white"] {
        background-color: white !important;
      }
      [style*="backgroundColor: \"#f9f9f9\""],
      [style*="background-color: #f9f9f9"] {
        background-color: #f9f9f9 !important;
      }
      [style*="backgroundColor: \"#f5f5f5\""],
      [style*="background-color: #f5f5f5"] {
        background-color: #f5f5f5 !important;
      }
      /* Prevent orphan pages */
      body::after {
        content: none !important;
      }
    }
    @media screen {
      .print-container {
        width: 280mm;
        margin: 0 auto;
      }
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
              padding: "12pt",
              textAlign: "center",
            }}
          >
            <div className="hidden sm:flex justify-center">
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
                {/* Row 1: Registration No. with Photo and Signature on right (rowSpan 6) */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      width: "25%",
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Registration No.
                  </td>
                  <td
                    style={{
                      width: "50%",
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.user_id}
                  </td>
                  <td
                    style={{
                      width: "25%",
                      textAlign: "center",
                      verticalAlign: "top",
                      padding: "8pt 10pt",
                      rowSpan: "6",
                      borderLeft: "1px solid #ccc",
                    }}
                    rowSpan="6"
                  >
                    <div style={{ marginBottom: "8pt", fontSize: "9pt", fontWeight: "bold", backgroundColor: "#f9f9f9", padding: "4pt 6pt", color: "#666" }}>
                      PHOTO
                    </div>
                    <img
                      src={getFilePath(application.photo)}
                      alt="Photo"
                      style={{
                        width: "100pt",
                        height: "120pt",
                        border: "1px solid #ccc",
                        objectFit: "cover",
                        marginBottom: "10pt",
                      }}
                    />
                    <div style={{ marginBottom: "8pt", fontSize: "9pt", fontWeight: "bold", backgroundColor: "#f9f9f9", padding: "4pt 6pt", color: "#666" }}>
                      SIGNATURE
                    </div>
                    <img
                      src={getFilePath(application.sign)}
                      alt="Signature"
                      style={{
                        width: "100pt",
                        height: "40pt",
                        border: "1px solid #ccc",
                        objectFit: "contain",
                      }}
                    />
                  </td>
                </tr>
                {/* Row 2: University */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    University
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.university}
                  </td>
                </tr>
                {/* Row 3: College */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    College
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.college}
                  </td>
                </tr>
                {/* Row 4: Department & Estb. Year */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Department & Estb. Year
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.subject} ({application.est_year})
                  </td>
                </tr>
                {/* Row 5: Designation */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Designation
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.designation}
                  </td>
                </tr>
                {/* Row 6: Research Experience */}
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Research Experience
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                    }}
                  >
                    {application.res_exp} Years
                  </td>
                </tr>
                {/* Row 7: Payment Details */}
                <tr>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      fontWeight: "bold",
                      borderRight: "1px solid #ccc",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Payment Details
                  </td>
                  <td
                    style={{
                      padding: "8pt 10pt",
                      borderRight: "1px solid #ccc",
                      color: application.appl_status === "PAID" ? "#22c55e" : "#22c55e",
                      fontWeight: "bold",
                    }}
                  >
                    {application.appl_status === "PAID"
                      ? `Txn Id: ${application.txn_id} | Amount: ₹${
                          application.txn_amt !== "--"
                            ? parseFloat(application.txn_amt).toFixed(2)
                            : "--"
                        }`
                      : "Fees Exempted"}
                  </td>
                </tr>
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
              {/* Current Screening Info from Workflow History */}
              <div style={{
                padding: "12px 16px",
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                marginBottom: "16px",
                fontSize: "13px"
              }}>
                <div style={{ marginBottom: "8px", fontWeight: "600", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Workflow History:</span>
                  {workflowInstance && (
                    <div style={{ fontSize: "12px", display: "flex", gap: "12px" }}>
                      {workflowInstance.rejectionCount > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          Total Rejections: {workflowInstance.rejectionCount}
                        </span>
                      )}
                      {workflowInstance.currentStepRejectionCount > 0 && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                          Current Step Rejections: {workflowInstance.currentStepRejectionCount}
                        </span>
                      )}
                      {workflowInstance.isLocked && (
                        <span className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold">
                          🔒 LOCKED
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {workflowHistory.length > 0 ? (
                  workflowHistory.map((log, index) => (
                    <div key={index} className="mb-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <strong>Step {log.stepOrder}: {log.stepName}</strong>
                      <div className="flex justify-between items-center">
                        <span>
                          Status: <span className={log.action === "Approve" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {log.action === "Approve" ? "Approved" : "Rejected"}
                          </span>
                        </span>
                        <span className="text-gray-400 text-xs">
                          {new Date(log.actionTimestamp).toLocaleString()}
                        </span>
                      </div>
                      {log.comments && <div className="text-gray-600 italic mt-1">Remark: {log.comments}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">No workflow history found.</div>
                )}
                
                {/* Fallback Legacy Info (only if no workflow history for that step) */}
                {screeningData && workflowHistory.length === 0 && (
                  <>
                    <div style={{ margin: "12px 0 8px", fontWeight: "600", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>Legacy Status:</div>
                    <div>
                      <strong>Screening 1:</strong>
                      {screeningData.screening1Status === 1 ? " Provisional Accepted" : screeningData.screening1Status === 2 ? " Rejected" : " Pending"}
                    </div>
                    <div>
                      <strong>Screening 2:</strong>
                      {screeningData.screening2Status === 1 ? " Final Accepted" : screeningData.screening2Status === 2 ? " Final Rejected" : " Pending"}
                    </div>
                  </>
                )}
              </div>

              {/* Locked Message */}
              {currentScreeningLocked && (
                <div style={{
                  padding: "12px 16px",
                  backgroundColor: workflowInstance?.isLocked ? "#fee2e2" : "#fef3c7",
                  border: workflowInstance?.isLocked ? "1px solid #fecaca" : "1px solid #fde68a",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  color: workflowInstance?.isLocked ? "#991b1b" : "#92400e",
                  fontWeight: "500"
                }}>
                  🔒 {workflowInstance?.isLocked 
                    ? `Application is LOCKED after ${workflowInstance.currentStepRejectionCount} rejections at this step. No further submissions allowed.`
                    : `Screening ${screeningType} is completed or locked.`
                  }
                </div>
              )}

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
                      Screening {screeningType} Status:
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
                            ✓ {screeningType === 6 ? 'Final Accepted' : 'Approved'}
                          </span>
                        </Radio>
                        <Radio
                          value="Not Eligible"
                          style={{ fontSize: "14px" }}
                        >
                          <span style={{ color: "#dc2626", fontWeight: "500" }}>
                            ✗ {screeningType === 6 ? 'Final Rejected' : 'Rejected'}
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
                      placeholder={`Enter remarks for Screening ${screeningType}...`}
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
                    <Button
                      module="supervisor_applications"
                      action="approve"
                      label={screeningType === 6 ? 'Final Submit' : 'Submit Approval'}
                      variant="solid"
                      size="md"
                      onClick={handleSubmit}
                      loading={submitting}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-md border-0"
                      style={{
                        backgroundColor: "#475569",
                        borderColor: "#475569",
                        color: "white",
                        borderRadius: "6px",
                        fontWeight: "500",
                        height: "40px",
                        paddingLeft: "20px",
                        paddingRight: "20px",
                        border: "none"
                      }}
                    />
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

export default SupervisorDetails;
