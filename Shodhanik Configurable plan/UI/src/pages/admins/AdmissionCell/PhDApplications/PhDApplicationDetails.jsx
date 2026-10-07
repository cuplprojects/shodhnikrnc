import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Printer, ExternalLink } from 'lucide-react';
import Button from '@/components/ui/Button';
import { fetchPhdApplicationDetails, updatePhdApplicationStatus } from '@/services/phdAdmissionService';
import workflowService from "@/services/workflowService";
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import PrintHeader from '@/components/cms/PrintHeader'
import useStaffAuthStore from '@/store/staffAuthStore';

// Custom TextArea component
const TextArea = ({ rows, value, onChange, placeholder, style, className }) => (
  <textarea
    rows={rows}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={style}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${className || ''}`}
  />
);

const PhDApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const [loading, setLoading] = useState(true);
  const [applicationData, setApplicationData] = useState(null);
  const [decisionStatus, setDecisionStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get return path from navigation state
  const returnPath = location.state?.returnPath || '/admission-cell/phd-applications';

  // Add print styles when component mounts
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-area,
        #printable-area * {
          visibility: visible;
        }
        #printable-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .print-hide {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    console.log('PhDApplicationDetails mounted with ID:', id);
    console.log('Location state:', location.state);
    fetchApplicationDetails();
  }, [id]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching application details for ID:', id);
      const data = await fetchPhdApplicationDetails(id);
      console.log('Application details received:', data);
      console.log('Uploads data:', data?.uploads);
      console.log('Academic qualifications:', data?.academicQualifications);
      setApplicationData(data);

      // Set initial status and remarks based on numeric status
      if (data?.scholar) {
        const currentStatus = data.scholar.decisionStatus;
        console.log('API returned decisionStatus:', currentStatus, 'type:', typeof currentStatus);

        if (currentStatus === 3 || currentStatus === "3") {
          setDecisionStatus("3"); // Accepted
        } else if (currentStatus === 2 || currentStatus === "2") {
          setDecisionStatus("2"); // Rejected
        } else {
          // For status 13, 0, null, undefined, or any other value, treat as Pending
          setDecisionStatus("0"); // Pending (default)
        }
        setRemarks(data.scholar.rejectReason || "");
      }
    } catch (error) {
      console.error('Error fetching application details:', error);
      const notify = notification();
      notify.error('Failed to load application details');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(returnPath);
  };

  const getStepID = (role) => {
    // Assuming a similar workflow structure for Scholar Registration
    switch (role) {
      case "16": return 1; // Example step mapping
      case "18": return 2;
      case "3": return 3;
      default: return 0;
    }
  };

  const handleSubmit = async () => {
    if (!decisionStatus) {
      const notify = notification();
      notify.error("Please select application status");
      return;
    }

    if (decisionStatus === "2" && !remarks.trim()) {
      const notify = notification();
      notify.error("Remarks are required for rejection");
      return;
    }

    const confirmed = await confirm({
      title: "Confirm Status Update",
      message: "Are you sure you want to update the application status?"
    });

    if (confirmed) {
      setSubmitting(true);
      try {
        const payload = {
          entityID: id,
          entityType: "Scholar",
          userId: user?.id,
          action: decisionStatus === "3" ? "Approve" : "Reject",
          comments: remarks,
          workflowName: "Scholar Registration"
        };

        const response = await workflowService.submitApprovalAction(payload);
        
        if (response.success) {
          notification().success("Application status updated successfully");
          navigate(returnPath);
        }
      } catch (error) {
        console.error("Error updating application status:", error);
        notification().error("Failed to update application status");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper function to calculate age
  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    let years = age;
    let months = monthDiff;
    let days = dayDiff;

    if (dayDiff < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} Years, ${months} Months and ${days} Days`;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Helper function to get status display text
  const getStatusDisplayText = (status) => {
    console.log('getStatusDisplayText called with status:', status, 'type:', typeof status);

    const numStatus = parseInt(status);

    if (status === 2 || status === "2") return "Rejected";
    if (!isNaN(numStatus) && numStatus > 2) return "Accepted"; // Status > 2 = Accepted
    // Handle 0, null, undefined, or empty values as Pending
    return "Pending"; // Default to pending
  };

  // Helper function to check if status can be updated (only when status is exactly 0)
  const canUpdateStatus = (status) => {
    console.log('canUpdateStatus called with status:', status, 'type:', typeof status);

    // Only allow updates when status is exactly 0 (Pending)
    const result = status === 0 || status === "0" || status === null || status === undefined || status === "";
    console.log('canUpdateStatus result:', result);
    return result;
  };

  // Helper function to get registration type text
  const getRegTypeText = (regType) => {
    const types = {
      1: 'Direct Admission',
      2: 'Research Entrance Test (RET)',
      3: 'Other'
    };
    return types[regType] || 'Unknown';
  };

  // Get document URLs from uploads
  const getDocumentUrl = (documentMasterID, uploadsArray) => {
    const upload = uploadsArray?.find(upload => upload.documentMasterID === documentMasterID);
    if (upload) {
      const baseURL = getBaseFileURL();
      return `${baseURL}/${upload.path}`;
    }
    return null;
  };

  // Get academic document URLs for a specific qualification
  const getAcademicDocumentUrls = (qualificationName, uploadsArray) => {
    if (!uploadsArray) return [];

    const baseURL = getBaseFileURL();
    const relatedUploads = uploadsArray.filter(upload => {
      // Match documents based on qualification name or common document types
      const path = upload.path?.toLowerCase() || '';
      const qualName = qualificationName?.toLowerCase() || '';

      // Common academic document patterns
      if (qualName.includes('high school') || qualName.includes('10th')) {
        return path.includes('10th') || path.includes('high') || path.includes('matric');
      }
      if (qualName.includes('intermediate') || qualName.includes('12th')) {
        return path.includes('12th') || path.includes('intermediate') || path.includes('inter');
      }
      if (qualName.includes('graduation') || qualName.includes('bachelor')) {
        return path.includes('graduation') || path.includes('bachelor') || path.includes('degree');
      }
      if (qualName.includes('post graduation') || qualName.includes('master')) {
        return path.includes('post') || path.includes('master') || path.includes('pg');
      }

      return false;
    });

    return relatedUploads.map(upload => ({
      url: `${baseURL}/${upload.path}`,
      filename: upload.path?.split('/').pop() || 'Document'
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading application details...</div>
      </div>
    );
  }

  if (!applicationData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Not Found</h2>
          <Button onClick={handleBack} variant="outline" size="sm" module="general" icon={<ArrowLeft size={16} />}>
            Back to Applications
          </Button>
        </div>
      </div>
    );
  }

  const { scholar, subject, personalDetails, academicQualifications, uploads } = applicationData;

  // Document Master IDs (based on common convention)
  const photoUrl = getDocumentUrl(1, uploads); // Photograph usually has ID 1
  const signatureUrl = getDocumentUrl(2, uploads); // Signature usually has ID 2

  return (
    <div className="p-4 md:p-5">
      {/* Header Controls - Hidden in print */}
      <div className="mb-4 flex justify-between items-center print-hide">
        <Button onClick={handleBack} variant="outline" size="sm" module="general" icon={<ArrowLeft size={16} />}>
          Back to Applications
        </Button>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md font-medium text-sm transition-all duration-200 hover:bg-blue-700"
          >
            <Printer size={16} />
            Print Application
          </button>
        </div>
      </div>

      {/* Application Preview - Printable */}
      <div id="printable-area" className="bg-white border border-[#e5e7eb] rounded-lg p-6 print:border-0 print:p-0">
        {/* Header */}
        <div className="hidden sm:flex justify-center mt-3 mb-0">
          <PrintHeader />
        </div>

        {/* Registration Info with Photo */}
        <div className="grid grid-cols-[1fr_auto] gap-4 mb-6">
          <table className="w-full border border-black text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Registration No.</td>
                <td className="p-2">{scholar?.applicationNo || scholar?.sid || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Reg. Type</td>
                <td className="p-2">{getRegTypeText(scholar?.regType)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Subject</td>
                <td className="p-2">{subject || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Mobile No.</td>
                <td className="p-2">{scholar?.phoneNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Email Id</td>
                <td className="p-2">{scholar?.email || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-col gap-2">
            <div className="border border-black w-32 h-40 flex items-center justify-center bg-gray-50">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Photograph"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <span className={`text-xs text-gray-500 ${photoUrl ? 'hidden' : ''}`}>Photo</span>
            </div>
            <div className="border border-black w-32 h-16 flex items-center justify-center bg-gray-50">
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt="Signature"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <span className={`text-xs text-gray-500 ${signatureUrl ? 'hidden' : ''}`}>Signature</span>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        {personalDetails && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">PERSONAL DETAILS</h3>
            <table className="w-full border border-black text-sm mb-6">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">Name</td>
                  <td className="p-2 border-r border-black w-1/4">{scholar?.name || 'N/A'}</td>
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">Father's Name</td>
                  <td className="p-2 w-1/4">{scholar?.fName || 'N/A'}</td>
                </tr>
                {personalDetails.mname && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Mother's Name</td>
                    <td className="p-2 border-r border-black">{personalDetails.mname}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Gender</td>
                    <td className="p-2">{personalDetails.gender}</td>
                  </tr>
                )}
                {personalDetails.dob && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Date of Birth</td>
                    <td className="p-2 border-r border-black">{formatDate(personalDetails.dob)}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Age</td>
                    <td className="p-2">{calculateAge(personalDetails.dob)}</td>
                  </tr>
                )}
                {personalDetails.maritalStatus && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Marital Status</td>
                    <td className="p-2 border-r border-black">{personalDetails.maritalStatus}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Category</td>
                    <td className="p-2">{personalDetails.category}</td>
                  </tr>
                )}
                {personalDetails.subCategory && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Sub Category</td>
                    <td className="p-2 border-r border-black">{personalDetails.subCategory}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Nationality</td>
                    <td className="p-2">{personalDetails.country}</td>
                  </tr>
                )}
                {personalDetails.domicile && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Domicile</td>
                    <td className="p-2 border-r border-black">{personalDetails.domicile}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Identity Proof</td>
                    <td className="p-2">{personalDetails.identityProof}</td>
                  </tr>
                )}
                {personalDetails.identityProofNo && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Identity Proof No.</td>
                    <td className="p-2" colSpan="3">{personalDetails.identityProofNo}</td>
                  </tr>
                )}
                {personalDetails.correspondenceAddress && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Correspondence Address</td>
                    <td className="p-2" colSpan="3">
                      {personalDetails.correspondenceAddress}
                      {personalDetails.cDistrict && `, ${personalDetails.cDistrict}`}
                      {personalDetails.cState && `, ${personalDetails.cState}`}
                      {personalDetails.cPincode && `, PIN-${personalDetails.cPincode}`}
                    </td>
                  </tr>
                )}
                {personalDetails.permanentAddress && (
                  <tr>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Permanent Address</td>
                    <td className="p-2" colSpan="3">
                      {personalDetails.permanentAddress}
                      {personalDetails.pDistrict && `, ${personalDetails.pDistrict}`}
                      {personalDetails.pState && `, ${personalDetails.pState}`}
                      {personalDetails.pPinCode && `, PIN-${personalDetails.pPinCode}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Academic Details */}
        {academicQualifications && academicQualifications.length > 0 && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">ACADEMIC DETAILS</h3>
            <table className="w-full border border-black text-sm mb-6">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="p-2 border-r border-black text-left">Qualification<br />Board/University</th>
                  <th className="p-2 border-r border-black text-left">Year</th>
                  <th className="p-2 border-r border-black text-left">Stream & Subject</th>
                  <th className="p-2 border-r border-black text-left">Marks<br />Obtained</th>
                  <th className="p-2 border-r border-black text-left">CGPA<br />Percentage</th>
                  <th className="p-2 text-left">Division</th>
                </tr>
              </thead>
              <tbody>
                {academicQualifications.map((edu, index) => (
                  <tr key={edu.aqid || index} className={index < academicQualifications.length - 1 ? 'border-b border-black' : ''}>
                    <td className="p-2 border-r border-black">
                      <div className="font-semibold">{edu.nameOfExamination}</div>
                      <div className="text-xs">{edu.boardUniversityName}</div>
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.isAppearing ? 'Appearing' : edu.passingYear}
                    </td>
                    <td className="p-2 border-r border-black">
                      <div>{edu.stream}</div>
                      <div className="text-xs">{edu.subject}</div>
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.marksObitained || 0}/{edu.maxMarks || 0}
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.percentageOrCGPA || 'N/A'}
                      {edu.percentageOrCGPA && (edu.markingRule === 'Percentage' ? '%' : ' CGPA')}
                    </td>
                    <td className="p-2">{edu.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Uploaded Documents Section */}
        {uploads && uploads.length > 0 && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black mt-6 print-hide">UPLOADED DOCUMENTS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 print-hide">
              {uploads.map((upload, index) => (
                <div key={upload.scholarUploadID || index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {upload.documentName || `Document ${upload.documentMasterID || index + 1}`}
                    </span>
                    {upload.decisionStatus !== null && (
                      <span className={`text-xs px-2 py-1 rounded ${upload.decisionStatus === 1 ? 'bg-green-100 text-green-800' :
                        upload.decisionStatus === 0 ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                        {upload.decisionStatus === 1 ? 'Approved' :
                          upload.decisionStatus === 0 ? 'Rejected' : 'Pending'}
                      </span>
                    )}
                  </div>
                  {upload.path && (
                    <a
                      href={`${getBaseFileURL()}/${upload.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                      title={`View ${upload.path}`}
                    >
                      <ExternalLink size={14} />
                      <span className="truncate">{upload.path?.split('/').pop() || 'Document'}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Application Status Update Section - Hidden in print */}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
              Application Status Update
            </h3>

            {/* Status Badge */}
            {(() => {
              const numStatus = parseInt(scholar?.decisionStatus);
              if (!isNaN(numStatus) && numStatus > 2) {
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#16a34a",
                    fontSize: "13px",
                    fontWeight: "600",
                    padding: "4px 10px",
                    backgroundColor: "#dcfce7",
                    borderRadius: "16px",
                    border: "1px solid #bbf7d0"
                  }}>
                    ✓ Accepted
                  </div>
                );
              } else if (scholar?.decisionStatus === 2 || scholar?.decisionStatus === "2") {
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: "600",
                    padding: "4px 10px",
                    backgroundColor: "#fef2f2",
                    borderRadius: "16px",
                    border: "1px solid #fecaca"
                  }}>
                    ✗ Rejected
                  </div>
                );
              } else {
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#d97706",
                    fontSize: "13px",
                    fontWeight: "600",
                    padding: "4px 10px",
                    backgroundColor: "#fef3c7",
                    borderRadius: "16px",
                    border: "1px solid #fde68a"
                  }}>
                    ⏳ Pending
                  </div>
                );
              }
            })()}
          </div>

          {/* Content */}
          <div style={{ padding: "20px" }}>
            {/* Current Status Info */}
            <div style={{
              padding: "12px 16px",
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "13px"
            }}>
              <div style={{ marginBottom: "8px", fontWeight: "600" }}>Current Application Status:</div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div><strong>Status:</strong> {getStatusDisplayText(scholar?.decisionStatus)}</div>
                {scholar?.decisionUpdateTime && (
                  <div><strong>Last Updated:</strong> {formatDate(scholar.decisionUpdateTime)}</div>
                )}
              </div>
              {scholar?.rejectReason && (
                <div style={{ marginTop: "8px" }}><strong>Current Remarks:</strong> {scholar.rejectReason}</div>
              )}
            </div>

            {/* Locked Message - Show when status is > 2 (Accepted) or = 2 (Rejected) */}
            {!canUpdateStatus(scholar?.decisionStatus) && (
              <div style={{
                padding: "12px 16px",
                backgroundColor: (() => {
                  const numStatus = parseInt(scholar?.decisionStatus);
                  if (!isNaN(numStatus) && numStatus > 2) return "#fef3c7"; // Green for accepted
                  return "#fef2f2"; // Red for rejected
                })(),
                border: (() => {
                  const numStatus = parseInt(scholar?.decisionStatus);
                  if (!isNaN(numStatus) && numStatus > 2) return "1px solid #fde68a";
                  return "1px solid #fecaca";
                })(),
                borderRadius: "6px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: (() => {
                  const numStatus = parseInt(scholar?.decisionStatus);
                  if (!isNaN(numStatus) && numStatus > 2) return "#92400e"; // Brown for accepted
                  return "#991b1b"; // Red for rejected
                })(),
                fontWeight: "500"
              }}>
                🔒 Application status is {getStatusDisplayText(scholar?.decisionStatus).toLowerCase()} - status cannot be changed
              </div>
            )}

            {/* Status Selection - Only show when status can be updated (status = 0/Pending) */}
            {canUpdateStatus(scholar?.decisionStatus) && (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "12px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#374151",
                    }}
                  >
                    Application Status:
                  </label>

                  {/* Status Radio Buttons */}
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", gap: "16px", flexDirection: "row" }}>

                      {/* Application Screening Passed Option */}
                      <div
                        style={{
                          fontSize: "14px",
                          flex: "1",
                          padding: "12px",
                          backgroundColor: decisionStatus === "3" ? "#f0f9ff" : "transparent",
                          borderRadius: "6px",
                          border: decisionStatus === "3" ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                          transition: "all 0.2s ease",
                          cursor: "pointer"
                        }}
                        onClick={() => {
                          setDecisionStatus("3");
                        }}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="decision-status-radio-group"
                            value="3"
                            checked={decisionStatus === "3"}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDecisionStatus("3");
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span style={{ color: "#16a34a", fontWeight: "500" }}>✓ Accept Application</span>
                        </label>
                      </div>

                      {/* Application Screening Rejected Option */}
                      <div
                        style={{
                          fontSize: "14px",
                          flex: "1",
                          padding: "12px",
                          backgroundColor: decisionStatus === "2" ? "#fef2f2" : "transparent",
                          borderRadius: "6px",
                          border: decisionStatus === "2" ? "2px solid #ef4444" : "2px solid #e5e7eb",
                          transition: "all 0.2s ease",
                          cursor: "pointer"
                        }}
                        onClick={() => {
                          setDecisionStatus("2");
                        }}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="decision-status-radio-group"
                            value="2"
                            checked={decisionStatus === "2"}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDecisionStatus("2");
                              }
                            }}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                          />
                          <span style={{ color: "#dc2626", fontWeight: "500" }}>✗ Reject Application</span>
                        </label>
                      </div>

                    </div>
                  </div>
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
                    {decisionStatus === "2" && (
                      <span style={{ color: "#dc2626", marginLeft: "4px" }}>*</span>
                    )}
                  </label>
                  <TextArea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter remarks for the application status..."
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
                    module="phd_applications"
                    action="approve"
                    label="Update Application Status"
                    variant="solid"
                    onClick={handleSubmit}
                    loading={submitting}
                    style={{
                      borderRadius: "6px",
                      fontWeight: "500",
                      height: "36px",
                      paddingLeft: "20px",
                      paddingRight: "20px"
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhDApplicationDetails;