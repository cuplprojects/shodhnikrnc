import { useState, useEffect } from 'react';
import { useSupervisorData } from '../../../../hooks/useSupervisorData';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useStepsSup from '../../../../hooks/useStepsSup';
import useStepSupStore from '../components/stepStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import PrintHeader from '@/components/cms/PrintHeader';
import { useFileViewer } from '@/services/FileViewerService';

const PreviewApplication = () => {
  const baseFileURL = getBaseFileURL();
  const [isAccepted, setIsAccepted] = useState(false);
  const navigate = useNavigate();
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState(null);
  const { saveStep } = useStepsSup();
  const { isStepCompleted, isStepReadOnly, checkScreeningStatus } = useStepSupStore();
  const [supervisorData, setSupervisorData] = useState(null);
  const { FileViewerModal, openFile } = useFileViewer();
  
  // Get supervisor ID from auth store
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  
  // Check screening status and set supervisor data
  useEffect(() => {
    const fetchScreeningStatus = async () => {
      try {
        const screeningResult = await checkScreeningStatus(supId);
        setSupervisorData({
          supId,
          hasRejectedScreening: screeningResult?.hasRejectedScreening || false,
          screeningData: screeningResult?.screeningData || null
        });
      } catch (error) {
        console.error('Error fetching screening status:', error);
        setSupervisorData({ supId, hasRejectedScreening: false });
      }
    };

    if (supId) {
      fetchScreeningStatus();
    }
  }, [supId, checkScreeningStatus]);
  
  // Calculate isReadOnly after supervisorData is available
  const isStep6ReadOnly = supervisorData ? isStepReadOnly(6, supervisorData) : false; // Step 6 is Preview Application

  const { data: applicationData, loading, error } = useSupervisorData(supId, false); // false = no transaction data for preview

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
          console.log('=== PREVIEW DOCUMENTS RESPONSE ===');
          console.log('Full response:', response.data);
          console.log('Photo path:', response.data.photo);
          console.log('Signature path:', response.data.sign);
          console.log('=== END PREVIEW DOCUMENTS ===');

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
    fetchSupervisorData();
  }, [supId]);

  const fetchSupervisorData = async () => {
    try {
      const response = await API.get(`/SupervisorRegistration/${supId}`);
      setSupervisorData(response.data);
    } catch (error) {
      console.log('Error fetching supervisor data:', error);
    }
  };

  // Auto-check the acceptance checkbox when step 5 is completed
  useEffect(() => {
    if (isStepCompleted(5)) {
      setIsAccepted(true);
    }
  }, [isStepCompleted]);

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

  const handleSubmit = async () => {
    if (isStep6ReadOnly) {
      return; // Silently prevent submission when read-only
    }
    
    if (!isAccepted) {
      notification().warning("Please accept the declaration to proceed.");
      return;
    }
    
    notification().success("Application submitted successfully!");
    setTimeout(async () => {
      const stepSaved = await saveStep(6);
      if (stepSaved) {
        navigate(SUPERVISOR_REGISTRATION_ROUTES.PAYMENT);
      }
    }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="text-center mb-6">
        <PrintHeader />
        <h3 className="text-base font-medium text-gray-600 mt-2">Application Form for Recognition of Research Supervisor (Ph.D. Programme)</h3>
        <h4 className="text-base font-medium text-red-600 mt-2">PREVIEW OF UNPAID APPLICATION</h4>
      </div>

      {/* Application Summary Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold p-2 w-1/4">Registration No.</td>
              <td className="border border-gray-400 p-2 w-1/2">{applicationData.registrationNo}</td>
              <td className="border border-gray-400 p-2 w-1/4 text-center" rowSpan="6">
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

      {/* Experience Details */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">EXPERIENCE DETAILS</h3>
        {applicationData.experience && applicationData.experience.length > 0 ? (
          <table className="w-full border-collapse border border-gray-400 text-sm">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Sr. No.</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Organization Name</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Designation</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Category</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Period (From - To)</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Experience</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Area of Specialization</th>
                <th className="border border-gray-400 bg-gray-100 font-semibold p-2">Document</th>
              </tr>
            </thead>
            <tbody>
              {applicationData.experience.map((exp, index) => (
                <tr key={exp.id || index}>
                  <td className="border border-gray-400 p-2 text-center">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{exp.organizationName || '-'}</td>
                  <td className="border border-gray-400 p-2">{exp.designation || '-'}</td>
                  <td className="border border-gray-400 p-2">{exp.category || '-'}</td>
                  <td className="border border-gray-400 p-2">
                    {exp.dateFrom ? new Date(exp.dateFrom).toLocaleDateString('en-GB') : '-'}
                    {' to '}
                    {exp.dateTo ? new Date(exp.dateTo).toLocaleDateString('en-GB') : 'Present'}
                  </td>
                  <td className="border border-gray-400 p-2">{exp.resExperience || '-'}</td>
                  <td className="border border-gray-400 p-2">{exp.areaOfSpec || '-'}</td>
                  <td className="border border-gray-400 p-2 text-center">
                    {exp.doc ? (
                      <button
                        onClick={() => openFile(`${baseFileURL}/${exp.doc}`, `Experience Document - ${exp.organizationName}`)}
                        className="text-blue-600 hover:text-blue-800 underline text-xs bg-none border-none p-0 cursor-pointer"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="border border-gray-400 p-3 text-sm text-gray-500">
            No experience details available
          </div>
        )}
      </div>

      {/* Research Activities */}

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
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">DECLARATION BY APPLICANT</h3>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-700 mb-4">
              This is to certify that presently I am not an approved Research supervisor in any subject/discipline of Chaudhary Charan Singh University, Meerut. The information given
              by me is correct to the best of my knowledge I also understand that all the future communication from DoR will be done on my Email ID and WhatsApp number
              given in this form.
            </p>
          </div>
          <div className="w-32 text-center">
            <div className="w-32 h-20 bg-blue-100 border border-gray-400 mb-2 flex items-center justify-center text-xs text-gray-500">
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
            <p className="text-xs font-semibold">(Signature of Applicant)</p>
          </div>
        </div>
      </div>

      {/* Acceptance Checkbox */}
      <div className="mb-6">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={isAccepted}
            onChange={(e) => setIsAccepted(e.target.checked)}
            disabled={isStep6ReadOnly}
            className={`mt-1 w-4 h-4 border-gray-300 rounded focus:ring-red-500 ${
              isStep6ReadOnly 
                ? 'text-amber-600 bg-amber-50 border-amber-300 cursor-not-allowed' 
                : 'text-red-600'
            }`}
          />
          <span className="text-red-600">
            I have read and accept above declaration. After payment you can not edit any details in your Application.
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <div className="text-center">
        <button
          onClick={handleSubmit}
          disabled={!isAccepted || isStep6ReadOnly}
          className={`font-semibold py-3 px-8 rounded-lg transition-colors duration-200 ${
            !isAccepted || isStep6ReadOnly
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed border border-gray-300' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Submit & Proceed to Payment
        </button>
      </div>

      {/* File Viewer Modal */}
      {FileViewerModal}
    </div>
  );
};

export default PreviewApplication;