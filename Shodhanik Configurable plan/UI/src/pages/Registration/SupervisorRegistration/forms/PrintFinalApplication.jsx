import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupervisorData } from '../../../../hooks/useSupervisorData';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import useStepsSup from '../../../../hooks/useStepsSup';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import PrintHeader from '@/components/cms/PrintHeader';
import { useFileViewer } from '@/services/FileViewerService';


const PrintFinalApplication = () => {
  const baseFileURL = getBaseFileURL();
  const navigate = useNavigate();
  const [uploadedDocuments, setUploadedDocuments] = useState(null);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const { FileViewerModal, openFile } = useFileViewer();
  
  // Get supervisor ID from auth store
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const { saveStep } = useStepsSup();
  const { data: applicationData, loading, error } = useSupervisorData(supId, true); // true = include transaction data for final print

  // Fetch uploaded documents
  useEffect(() => {
    const fetchUploadedDocuments = async () => {
      try {
        setDocumentsLoading(true);
        
        if (!supId) {
          setDocumentsLoading(false);
          return;
        }
        
        const response = await API.get(`/SupervisorUploads/${supId}`);
        
        if (response.data) {
          console.log('=== PRINT DOCUMENTS RESPONSE ===');
          console.log('Full response:', response.data);
          console.log('Photo path:', response.data.photo);
          console.log('Signature path:', response.data.sign);
          console.log('=== END PRINT DOCUMENTS ===');
          
          setUploadedDocuments(response.data);
        }
      } catch (error) {
        console.error('Error fetching uploaded documents:', error);
        // If no documents found (404), that's normal for new registrations
        if (error.response?.status !== 404) {
          console.error('Unexpected error:', error);
        }
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchUploadedDocuments();
  }, [supId]);
  
  if (loading || documentsLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!applicationData) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white">
        <div className="text-center">
          <p className="text-gray-600">No application data found.</p>
        </div>
      </div>
    );
  }

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Get the printable content
      const printContent = document.getElementById('print-content').innerHTML;
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      // Write the content with proper styling
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Supervisor Application - ${applicationData.registrationNo}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
                background: white;
                padding: 20px;
              }
              
              .text-center { text-align: center; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .mb-6 { margin-bottom: 24px; }
              .mb-4 { margin-bottom: 16px; }
              .mb-3 { margin-bottom: 12px; }
              .mb-2 { margin-bottom: 8px; }
              .mt-8 { margin-top: 32px; }
              .p-2 { padding: 8px; }
              .p-3 { padding: 12px; }
              .pr-8 { padding-right: 32px; }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              
              th, td {
                border: 1px solid #000;
                padding: 8px;
                text-align: left;
                vertical-align: top;
              }
              
              th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
              
              .bg-gray-100 {
                background-color: #f0f0f0;
              }
              
              .w-20 {
                width: 80px;
                height: 80px;
                background-color: #e3f2fd;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 16px;
              }
              
              .flex {
                display: flex;
              }
              
              .items-center {
                align-items: center;
              }
              
              .justify-center {
                justify-content: center;
              }
              
              .justify-between {
                justify-content: space-between;
              }
              
              .items-start {
                align-items: flex-start;
              }
              
              .flex-1 {
                flex: 1;
              }
              
              .space-y-1 > * + * {
                margin-top: 4px;
              }
              
              .space-y-2 > * + * {
                margin-top: 8px;
              }
              
              .w-32 {
                width: 128px;
              }
              
              .h-40 {
                height: 160px;
              }
              
              .h-16 {
                height: 64px;
              }
              
              .h-24 {
                height: 96px;
              }
              
              .w-40 {
                width: 160px;
              }
              
              .bg-gray-200, .bg-blue-100 {
                background-color: #f5f5f5;
              }
              
              .mx-auto {
                margin-left: auto;
                margin-right: auto;
              }
              
              img {
                max-width: 100%;
                height: auto;
                display: block;
              }
              
              .object-fitcover {
                object-fit: cover;
              }
              
              .object-contain {
                object-fit: contain;
              }
              
              .text-xs {
                font-size: 10px;
              }
              
              .text-sm {
                font-size: 11px;
              }
              
              .text-base {
                font-size: 12px;
              }
              
              .text-lg {
                font-size: 14px;
              }
              
              .text-xl {
                font-size: 16px;
              }
              
              .leading-relaxed {
                line-height: 1.6;
              }
              
              .no-print {
                display: none !important;
              }
              
              @media print {
                body {
                  padding: 0;
                  margin: 0;
                }
                
                .no-print {
                  display: none !important;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };

      // Save step and navigate to status page after printing
      notification().success("Application printed successfully!");
      
      setTimeout(async () => {
        try {
          const stepSaved = await saveStep(8); // Step 7 is print step
          if (stepSaved) {
            navigate(SUPERVISOR_REGISTRATION_ROUTES.STATUS);
          } else {
            notification().error("Failed to update step progress. Please try again.");
          }
        } catch (error) {
          console.error("Error saving step:", error);
          notification().error("Failed to update step progress. Please try again.");
        }
      }, 1500);
      
    } catch (error) {
      console.error("Error during print:", error);
      notification().error("Failed to print application. Please try again.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      {/* Printable Content */}
      <div id="print-content">
        {/* Header */}
        <div className="text-center mb-6">
            
            <PrintHeader/>
              <h3 className="text-base font-medium text-gray-900">Application Form for Recognition of Research Supervisor (Ph.D. Programme)</h3>
          
        </div>

      {/* Application Summary Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Registration No.</td>
              <td className="border border-gray-400 p-2 w-1/2">{applicationData.registrationNo}</td>
              <td className="border border-gray-400 p-2 w-1/4 text-center" rowSpan="5">
                <div className="space-y-2">
                  <div className="w-32 h-40 bg-gray-200 mx-auto flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                    {uploadedDocuments?.photo ? (
                      <img
                        src={`${baseFileURL}/${uploadedDocuments.photo}`}
                        alt="Photograph"
                        className="w-full h-full object-fitcover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <span>Photograph</span>
                    )}
                    <div className="w-full h-full items-center justify-center text-xs text-gray-500" style={{ display: 'none' }}>
                      Photograph
                    </div>
                  </div>
                  <div className="w-32 h-16 bg-gray-200 mx-auto flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                    {uploadedDocuments?.sign ? (
                      <img
                        src={`${baseFileURL}/${uploadedDocuments.sign}`}
                        alt="Signature"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <span>Signature</span>
                    )}
                    <div className="w-full h-full items-center justify-center text-xs text-gray-500" style={{ display: 'none' }}>
                      Signature
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">University</td>
              <td className="border border-gray-400 p-2">{applicationData.university}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">College</td>
              <td className="border border-gray-400 p-2">{applicationData.college}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Department & Estb. Year</td>
              <td className="border border-gray-400 p-2">{applicationData.department}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Designation</td>
              <td className="border border-gray-400 p-2">{applicationData.designation}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Research Experience</td>
              <td className="border border-gray-400 p-2" colSpan="2">{applicationData.researchExperience}</td>
            </tr>
            
              <tr>
                <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Payment Details</td>
                <td className="border border-gray-400 p-2" colSpan="2">
                  {!applicationData.transactionDetails || applicationData.transactionDetails?.status?.toLowerCase() === 'exempted' ? (
                    <td style={{ padding: "8pt 10pt" }} colSpan="2">
                      <b style={{ color: "#16a34a" }}>Exempted</b>
                    </td>
                  ) : applicationData.transactionDetails?.txnId ? (
                    <div>
                      <strong>Txn Id :</strong> {applicationData.transactionDetails.txnId} &nbsp;&nbsp;
                      <strong>Amount (₹) :</strong> {applicationData.transactionDetails.amount} &nbsp;&nbsp;
                      <strong>Txn Date:</strong> {applicationData.transactionDetails.txnDate}
                      {applicationData.transactionDetails.status && (
                        <>
                          &nbsp;&nbsp;
                          <strong>Status:</strong> 
                          <span className={`ml-1 px-2 py-1 rounded text-sm font-semibold ${
                            applicationData.transactionDetails.status?.toLowerCase() === 'successful' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {applicationData.transactionDetails.status}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">No payment details available</span>
                  )}
                </td>
              </tr>
            
          </tbody>
        </table>
      </div>

      {/* Personal Details */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">PERSONAL DETAILS</h3>
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Name</td>
              <td className="border border-gray-400 p-2 w-1/4">{applicationData.personalDetails.name}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Father's Name</td>
              <td className="border border-gray-400 p-2 w-1/4">{applicationData.personalDetails.fatherName}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Date of Birth</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.dateOfBirth}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Age</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.age}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Gender</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.gender}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Nationality</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.nationality}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Identity Proof</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.identityProof}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Identity Proof No.</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.identityProofNo}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Mailing Address</td>
              <td className="border border-gray-400 p-2" colSpan="3">{applicationData.personalDetails.mailingAddress}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Permanent Address</td>
              <td className="border border-gray-400 p-2" colSpan="3">{applicationData.personalDetails.permanentAddress}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Mobile No.</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.mobileNo}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Email Id</td>
              <td className="border border-gray-400 p-2">{applicationData.personalDetails.emailId}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PhD Details */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">DETAILS OF PH.D.</h3>
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Name of University</td>
              <td className="border border-gray-400 p-2 w-3/4" colSpan="3">{applicationData.phdDetails.universityName}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Discipline</td>
              <td className="border border-gray-400 p-2 w-1/4">{applicationData.phdDetails.discipline}</td>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Supervisor Name</td>
              <td className="border border-gray-400 p-2 w-1/4">{applicationData.phdDetails.supervisorName}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Area of Specialization</td>
              <td className="border border-gray-400 p-2" colSpan="3">{applicationData.phdDetails.areaOfSpecialization}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Title of Thesis</td>
              <td className="border border-gray-400 p-2" colSpan="3">{applicationData.phdDetails.thesisTitle}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2">Awarded (Year & Month)</td>
              <td className="border border-gray-400 p-2" colSpan="3">{applicationData.phdDetails.awardedYear}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">EXPERIENCE DETAILS</h3>
        {applicationData.experience && applicationData.experience.length > 0 ? (
          <table className="w-full border-collapse border border-gray-400 text-sm">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2 w-12">Sr. No.</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Organization</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Designation</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Category</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Period</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Experience</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Area of Spec.</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Document</th>
              </tr>
            </thead>
            <tbody>
              {applicationData.experience.map((exp, index) => (
                <tr key={exp.id || index}>
                  <td className="border border-gray-400 p-2 text-center">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{exp.organizationName}</td>
                  <td className="border border-gray-400 p-2">{exp.designation}</td>
                  <td className="border border-gray-400 p-2">{exp.category}</td>
                  <td className="border border-gray-400 p-2">
                    {exp.dateFrom ? new Date(exp.dateFrom).toLocaleDateString("en-GB") : "--"}
                    {" to "}
                    {exp.dateTo ? new Date(exp.dateTo).toLocaleDateString("en-GB") : "Present"}
                  </td>
                  <td className="border border-gray-400 p-2">{exp.resExperience}</td>
                  <td className="border border-gray-400 p-2">{exp.areaOfSpec}</td>
                  <td className="border border-gray-400 p-2 text-center">
                    {exp.doc ? (
                      <button
                        onClick={() => openFile(`${baseFileURL}/${exp.doc}`, `Experience Document - ${exp.organizationName}`)}
                        className="text-blue-600 underline hover:text-blue-800 cursor-pointer bg-none border-none p-0"
                      >
                        View
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="border border-gray-400 p-3 text-sm text-gray-600">
            No experience details available
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">RESEARCH ACTIVITIES</h3>
        <div className="border border-gray-400 p-3 text-sm">
          {applicationData.researchActivities}
        </div>
      </div>

      {/* Research Papers */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">RESEARCH PAPERS</h3>
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 font-semibold p-2 w-12">Sr. No.</th>
              <th className="border border-gray-400 bg-gray-100 font-semibold p-2 w-32">Title of Paper</th>
              <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {applicationData.researchPapers && applicationData.researchPapers.length > 0 ? (
              applicationData.researchPapers.map((paper) => (
                <tr key={paper.srNo}>
                  <td className="border border-gray-400 p-2 text-center">{paper.srNo}</td>
                  <td className="border border-gray-400 p-2">{paper.title}</td>
                  <td className="border border-gray-400 p-2">
                    <div className="space-y-1">
                      <div><strong>Year of Publication:</strong> {paper.yearOfPublication}, <strong>Name of Journal:</strong> {paper.nameOfJournal}</div>
                      <div><strong>Author(s):</strong> {paper.authors}</div>
                      <div><strong>ISSN No.:</strong> {paper.issnNo}, <strong>Volume:</strong> {paper.volume}, <strong>Page No.:</strong> {paper.pageNo}</div>
                      <div><strong>Listed In:</strong> {paper.listedIn}, <strong>UGC List No.:</strong> {paper.ugcListNo}</div>
                      <div><strong>Citations:</strong> {paper.citations}, <strong>Impact Factor:</strong> {paper.impactFactor}</div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border border-gray-400 p-2 text-center" colSpan="3">
                  No research papers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Declaration */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">DECLARATION BY APPLICANT</h3>
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-8">
            <p className="text-sm text-gray-700 leading-relaxed">
              This is to certify that presently I am not an approved Research supervisor in any subject/discipline of Chaudhary Charan Singh University, Meerut. The information given 
              by me is correct to the best of my knowledge I also understand that all the future communication from DoR will be done on my Email ID and WhatsApp number 
              given in this form.
            </p>
          </div>
          <div className="text-center">
            <div className="w-40 h-24 bg-blue-100 border border-gray-400 mb-2 flex items-center justify-center">
              {uploadedDocuments?.sign ? (
                <img
                  src={`${baseFileURL}/${uploadedDocuments.sign}`}
                  alt="Signature"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <span className="text-xs text-gray-500">Signature</span>
              )}
              <div className="w-full h-full items-center justify-center text-xs text-gray-500" style={{ display: 'none' }}>
                Signature
              </div>
            </div>
            <p className="text-sm font-semibold">(Signature of Applicant)</p>
          </div>
        </div>
      </div>

      </div>

      {/* Print Button - Hidden during print */}
      <div className="no-print text-center mt-8">
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className={`font-semibold py-2 px-6 rounded transition-colors duration-200 ${
            isPrinting
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isPrinting ? 'Processing...' : 'Print & Complete Application'}
        </button>
        <p className="text-sm text-gray-600 mt-2">
          Clicking this button will print your application and mark it as complete.
        </p>
      </div>

      {/* File Viewer Modal */}
      {FileViewerModal}
    </div>
  );
};

export default PrintFinalApplication;
