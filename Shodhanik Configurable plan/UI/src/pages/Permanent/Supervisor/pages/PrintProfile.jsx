import { Printer, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import useStaffAuthStore from '@/store/staffAuthStore';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';


const PrintProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Get supervisor ID from auth store or props
  const { getSupId } = useSupervisorAuthStore();
  const supervisorId = getSupId();

  // Fetch data from API
  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get(`/SupervisorPersonals/AllSelected?id=${supervisorId}`);

      setProfileData(response.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  // Helper function to get categories by categoryId
  const getCategoriesByType = (categoryId) => {
    return profileData?.categories?.filter(cat => cat.categoryId === categoryId) || [];
  };

  // Helper function to get photo URL
  const getPhotoURL = () => {
    if (profileData?.supUploads?.photo) {
      const baseFileURL = getBaseFileURL();
      return `${baseFileURL}/${profileData.supUploads.photo}`;
    }
    return null;
  };

  // Helper function to get signature URL
  const getSignatureURL = () => {
    if (profileData?.supUploads?.sign) {
      const baseFileURL = getBaseFileURL();
      return `${baseFileURL}/${profileData.supUploads.sign}`;
    }
    return null;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    alert('PDF download functionality will be implemented');
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="text-lg">Loading profile data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col justify-center items-center">
        <div className="text-lg text-red-600 mb-4">Error loading profile: {error}</div>
        <button
          onClick={fetchProfileData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Print Profile</h1>
          <p className="text-gray-600">Generate and print your complete supervisor profile</p>
        </div>
        <div className="flex gap-3">
          {/* <button
            onClick={fetchProfileData}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Refresh
          </button> */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Printer size={20} />
            Print
          </button>
          {/* <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={20} />
            Download PDF
          </button> */}
        </div>
      </div>

      {/* Print Preview */}
      <div className="bg-white border border-gray-300 rounded-lg p-8 shadow-sm print:shadow-none print:border-none print:p-4">

        {/* University Header */}
        <div className="hidden sm:flex justify-center mt-3 mb-0">
          <PrintHeader />
        </div>
        <div className="w-20"></div>
        <div className="bg-blue-600 text-white py-2 mt-4">
          <h2 className="text-lg font-bold">RESEARCH SUPERVISOR PROFILE</h2>
        </div>
        {/* Personal Information Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-blue-600 mb-2">
              {profileData?.registration?.title} {profileData?.registration?.fullName?.toUpperCase()} ({profileData?.shodhnikId})
            </h2>
            <div className="text-sm space-y-1">
              <p><strong>{profileData?.designationName}</strong></p>
              <p>Department of {profileData?.subject}</p>
              <p>{profileData?.registration?.mobileNo}, {profileData?.registration?.email}</p>
            </div>
            <div className="mt-3 text-sm">
              <p><strong>Research Interests / Specialization:</strong> {profileData?.research?.[0]?.researchArea}</p>
              <p><strong>Experience:</strong> {profileData?.research?.[0]?.researchYear} Years</p>
            </div>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <div className="w-24 h-32 border border-gray-300 bg-gray-100 flex items-center justify-center text-xs overflow-hidden">
              {getPhotoURL() ? (
                <img
                  src={getPhotoURL()}
                  alt="Supervisor Photo"
                  className="w-full h-full object-fitcover"
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${getPhotoURL() ? 'hidden' : 'flex'}`}>
                Photo
              </div>
            </div>

            {/* Signature below photo */}
            <div className="text-center">
              <div className="w-24 h-12 border border-gray-300 bg-gray-100 flex items-center justify-center text-xs overflow-hidden mb-1">
                {getSignatureURL() ? (
                  <img
                    src={getSignatureURL()}
                    alt="Supervisor Signature"
                    className="w-full h-full object-contain"
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${getSignatureURL() ? 'hidden' : 'flex'}`}>
                  Signature
                </div>
              </div>
              <div className="text-xs border-t border-gray-400 pt-1">
                Signature
              </div>
            </div>
          </div>
        </div>

        {/* Educational Qualifications */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
            EDUCATIONAL QUALIFICATIONS
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-100">
                <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                <th className="border border-gray-400 p-2 text-left">Course / Degree</th>
                <th className="border border-gray-400 p-2 text-left">Year</th>
                <th className="border border-gray-400 p-2 text-left">Institution & Details of Subject/Topic/Thesis</th>
              </tr>
            </thead>
            {/* <tbody>
              {profileData?.qualification?.map((qual, index) => (
                <tr key={qual.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-400 p-2">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{qual.course}</td>
                  <td className="border border-gray-400 p-2">{qual.year}</td>
                  <td className="border border-gray-400 p-2">{qual.institution} - {qual.details}</td>
                </tr>
              ))}
            </tbody> */}
            <tbody>
              {[
                ...(profileData?.qualification || []),

                // ✅ Add PhD from education
                profileData?.education && {
                  id: "phd",
                  course: "Ph.D.",
                  year: profileData.education.monthAndYear,
                  institution: profileData.education.phdUniversity,
                  details: profileData.education.thesisTitle
                }
              ]
                .filter(Boolean)
                .map((qual, index) => (
                  <tr
                    key={qual.id}
                    className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{qual.course}</td>
                    <td className="border border-gray-400 p-2">{qual.year}</td>
                    <td className="border border-gray-400 p-2">
                      {qual.institution} - {qual.details}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Career Profile */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
            CAREER PROFILE
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-100">
                <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                <th className="border border-gray-400 p-2 text-left">Organization / Institution</th>
                <th className="border border-gray-400 p-2 text-left">Designation</th>
                <th className="border border-gray-400 p-2 text-left">Duration & Nature of Duties</th>
              </tr>
            </thead>
            <tbody>
              {profileData?.experience?.map((exp, index) => (
                <tr key={exp.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-400 p-2">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{exp.organizationName}</td>
                  <td className="border border-gray-400 p-2">{exp.designation}</td>
                  <td className="border border-gray-400 p-2">
                    {exp.dateTo === 'Present' ?
                      `${new Date(exp.dateFrom).toLocaleDateString()} to Present` :
                      `${new Date(exp.dateFrom).toLocaleDateString()} to ${new Date(exp.dateTo).toLocaleDateString()}`
                    }
                    <br />{exp.natureOfDuties}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Research Scholars */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
            NO. OF RESEARCH SCHOLARS SUCCESSFULLY GUIDED
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-100">
                <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                <th className="border border-gray-400 p-2 text-left">Name of Programme</th>
                <th className="border border-gray-400 p-2 text-left">Awarded</th>
                <th className="border border-gray-400 p-2 text-left">Under Supervision</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="border border-gray-400 p-2">1</td>
                <td className="border border-gray-400 p-2">Ph. D.</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.phd_Awarded || 0}</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.phd_UnderSupervision || 0}</td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-400 p-2">2</td>
                <td className="border border-gray-400 p-2">M. Phil</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.mPhil_Awarded || 0}</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.mPhil_UnderSupervision || 0}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-400 p-2">3</td>
                <td className="border border-gray-400 p-2">Dissertation (M.Ed. / M.A.)</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.dissertation || 0}</td>
                <td className="border border-gray-400 p-2">{profileData?.research?.[0]?.dissertationUnderSupervision || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Research Publication IDs */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
            RESEARCH PUBLICATION IDs
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-gray-400 p-2">
              <strong>Scopus:</strong> {profileData?.research?.[0]?.scopus || 'N/A'}
            </div>
            <div className="border border-gray-400 p-2">
              <strong>Orchid:</strong> {profileData?.research?.[0]?.orchid || 'N/A'}
            </div>
            <div className="border border-gray-400 p-2">
              <strong>Publons:</strong> {profileData?.research?.[0]?.publOns || 'N/A'}
            </div>
            <div className="border border-gray-400 p-2">
              <strong>Vidwan:</strong> {profileData?.research?.[0]?.vidwan || 'N/A'}
            </div>
          </div>
          <div className="mt-2 text-xs border border-gray-400 p-2">
            <strong>Google Scholar:</strong> {profileData?.research?.[0]?.googleScholar || 'N/A'}
          </div>
        </div>

        {/* Publications Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
            PUBLICATIONS / ACADEMIC ACTIVITIES SUMMARY
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-100">
                <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                <th className="border border-gray-400 p-2 text-left">Publications / Academic Activities Type</th>
                <th className="border border-gray-400 p-2 text-left">Count</th>
              </tr>
            </thead>
            <tbody>
              {profileData?.categoryCounts?.map((category, index) => (
                <tr key={category.categoryId} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-400 p-2">{index + 1}</td>
                  <td className="border border-gray-400 p-2">{category.categoryName}</td>
                  <td className="border border-gray-400 p-2">{category.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed Publications Sections */}

        {/* Authored Books & Monographs */}
        {getCategoriesByType(1).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              AUTHORED BOOKS & MONOGRAPHS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Book Title</th>
                  <th className="border border-gray-400 p-2 text-left">Author(s)</th>
                  <th className="border border-gray-400 p-2 text-left">ISBN</th>
                  <th className="border border-gray-400 p-2 text-left">Citations</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(1).map((book, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{book.nameOfBook || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.nameOfAuthor || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.isbn || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.citations || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edited Books */}
        {getCategoriesByType(2).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              EDITED BOOKS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Book Title</th>
                  <th className="border border-gray-400 p-2 text-left">ISBN</th>
                  <th className="border border-gray-400 p-2 text-left">DOI Number</th>
                  <th className="border border-gray-400 p-2 text-left">Citations</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(2).map((book, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{book.nameOfBook || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.isbn || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.doiNumber || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{book.citations || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Papers Published in UGC Care Listed / Indexed / Peer Reviewed Journals */}
        {getCategoriesByType(3).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              PAPERS PUBLISHED IN UGC CARE LISTED / INDEXED / PEER REVIEWED JOURNALS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Paper Title</th>
                  <th className="border border-gray-400 p-2 text-left">Journal Name</th>
                  <th className="border border-gray-400 p-2 text-left">Author(s)</th>
                  <th className="border border-gray-400 p-2 text-left">ISSN No.</th>
                  <th className="border border-gray-400 p-2 text-left">Impact Factor</th>
                  <th className="border border-gray-400 p-2 text-left">Citations</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(3).map((paper, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{paper.titleOfPaper || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{paper.nameOfJournal || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{paper.nameOfAuthor || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{paper.issnNo || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{paper.impactFactor || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{paper.citations || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chapters / Papers Published in Edited Books */}
        {getCategoriesByType(4).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              CHAPTERS / PAPERS PUBLISHED IN EDITED BOOKS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Chapter Title</th>
                  <th className="border border-gray-400 p-2 text-left">Name & Address</th>
                  <th className="border border-gray-400 p-2 text-left">ISBN</th>
                  <th className="border border-gray-400 p-2 text-left">DOI Number</th>
                  <th className="border border-gray-400 p-2 text-left">Citations</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(4).map((chapter, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{chapter.titleOfChapter || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{chapter.nameAndAddress || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{chapter.isbn || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{chapter.doiNumber || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{chapter.citations || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invited as Resource Lectures Person / Examiner/Expert */}
        {getCategoriesByType(5).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              INVITED AS RESOURCE LECTURES PERSON / EXAMINER/EXPERT
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Institution</th>
                  <th className="border border-gray-400 p-2 text-left">Details of Event</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(5).map((event, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{event.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{event.institution || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{event.detailsOfEvent || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Seminars / Conferences / Workshops Organized */}
        {getCategoriesByType(6).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              SEMINARS / CONFERENCES / WORKSHOPS ORGANIZED
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Institution</th>
                  <th className="border border-gray-400 p-2 text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(6).map((event, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{event.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{event.institution || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{event.category || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Projects */}
        {getCategoriesByType(7).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              RESEARCH PROJECTS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Project Name</th>
                  <th className="border border-gray-400 p-2 text-left">Funding Agency</th>
                  <th className="border border-gray-400 p-2 text-left">Amount</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(7).map((project, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{project.nameOfProject || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{project.fundingAgency || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{project.amount ? `₹ ${project.amount}` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Administrative Positions / Assignments Held */}
        {getCategoriesByType(8).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              ADMINISTRATIVE POSITIONS / ASSIGNMENTS HELD
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Activity Type</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Details of Event</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(8).map((position, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{position.activityType || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{position.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{position.detailsOfEvent || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Seminars / Conference Presentations */}
        {getCategoriesByType(9).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              SEMINARS / CONFERENCE PRESENTATIONS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Institution</th>
                  <th className="border border-gray-400 p-2 text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(9).map((presentation, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{presentation.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{presentation.institution || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{presentation.category || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Memberships of Academic / Professional Bodies */}
        {getCategoriesByType(10).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              MEMBERSHIPS OF ACADEMIC / PROFESSIONAL BODIES
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Academic Name</th>
                  <th className="border border-gray-400 p-2 text-left">Member Type</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(10).map((membership, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{membership.academicName || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{membership.memberType || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Participation in Community Service / Exchange Programs / Consulting Activity */}
        {getCategoriesByType(11).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              PARTICIPATION IN COMMUNITY SERVICE / EXCHANGE PROGRAMS / CONSULTING ACTIVITY
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Activity Type</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Details of Event</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(11).map((activity, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{activity.activityType || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{activity.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{activity.detailsOfEvent || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Patents */}
        {getCategoriesByType(12).length > 0 && (
          <div className="mb-6 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-blue-600 mb-3 border-b border-blue-600 pb-1">
              PATENTS
            </h3>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-400 p-2 text-left">Sr. No.</th>
                  <th className="border border-gray-400 p-2 text-left">Activity Type</th>
                  <th className="border border-gray-400 p-2 text-left">Application Name</th>
                  <th className="border border-gray-400 p-2 text-left">Application Number</th>
                  <th className="border border-gray-400 p-2 text-left">Date</th>
                  <th className="border border-gray-400 p-2 text-left">Category</th>
                  <th className="border border-gray-400 p-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {getCategoriesByType(12).map((patent, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-400 p-2">{index + 1}</td>
                    <td className="border border-gray-400 p-2">{patent.activityType || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{patent.applicationName || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{patent.applicationNumber || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{patent.date || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{patent.category || 'N/A'}</td>
                    <td className="border border-gray-400 p-2">{patent.detailsOfEvent || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
          <p>Supervisor Profile Printed from Research Management System, DoR, Chaudhary Charan Singh University, Meerut</p>
          <p className="mt-1">Generated on: {new Date().toLocaleDateString('en-IN')} at {new Date().toLocaleTimeString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintProfile;