import API from '@/services/API';
// Base API URL

// Fetch supervisor details by ID
export const fetchSupervisorDetails = async (id) => {
  try {
    const response = await API.get(`/SupervisorPersonals/AllDetail?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching supervisor details:', error);
    throw error;
  }
};

// Transform API data to application format
export const transformApiDataToApplicationFormat = (apiData, includeTransaction = false) => {
  if (!apiData) return null;

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Calculate age helper
  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    const ageInMs = today - birth;
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(ageInDays / 365);
    const months = Math.floor((ageInDays % 365) / 30);
    const days = ageInDays % 30;
    return `${years} Years, ${months} Months and ${days} Days`;
  };

  // Get the first education entry for main details
  const primaryEducation = apiData.education && apiData.education.length > 0 ? apiData.education[0] : {};

  // Build addresses
  const mailingAddress = `${apiData.coAddress || ''}, ${apiData.coDistrict || ''}, ${apiData.coState || ''}, PIN-${apiData.coPinCode || ''}`.replace(/^,\s*|,\s*$/g, '');
  const permanentAddress = `${apiData.peAddress || ''}, ${apiData.peDistrict || ''}, ${apiData.peState || ''}, PIN-${apiData.pePinCode || ''}`.replace(/^,\s*|,\s*$/g, '');

  const transformedData = {
    registrationNo: apiData.registration?.applicationNumber || '',
    university: primaryEducation.universityName || primaryEducation.universityType,
    college: primaryEducation.collegeName || primaryEducation.collegeNames,
    department: `${apiData.subjectName || ''} (${primaryEducation.deptEst || ''})`,
    designation: apiData.designationName || '',
    retirementDate: formatDate(apiData.retirementDate),
    researchExperience: `${primaryEducation.researchExp || '0'} Year(s)`,
    personalDetails: {
      name: apiData.registration?.fullName || '',
      fatherName: apiData.registration?.fatherName || '',
      dateOfBirth: formatDate(apiData.dateOfBirth),
      age: calculateAge(apiData.dateOfBirth),
      gender: apiData.gender || '',
      nationality: apiData.nationality || '',
      identityProof: apiData.identityProofName || '',
      identityProofNo: apiData.identityProofNo || '',
      mailingAddress: mailingAddress,
      permanentAddress: permanentAddress,
      mobileNo: apiData.registration?.mobileNo || '',
      emailId: apiData.registration?.email || ''
    },
    phdDetails: {
      universityName: primaryEducation.phdUniversity || '',
      discipline: primaryEducation.phdSubject || '',
      supervisorName: primaryEducation.supervisorName || '',
      areaOfSpecialization: primaryEducation.areaOfSpec || '',
      thesisTitle: primaryEducation.thesisTitle || '',
      awardedYear: primaryEducation.researchExp || ''
    },
    teachingExperience: {
      pgTeaching: `${primaryEducation.pgt || 0} Year(s)`,
      ugTeaching: `${primaryEducation.ugt || 0} Year(s)`
    },
    researchActivities: primaryEducation.researchDesc || '',
    researchPapers: (apiData.research || []).map((paper, index) => ({
      srNo: index + 1,
      title: paper.titleOfPaper || '',
      yearOfPublication: paper.pubYear || '',
      nameOfJournal: paper.journalName || '',
      authors: paper.authorName || '',
      issnNo: paper.issNo || '',
      volume: paper.volume || '',
      pageNo: paper.page || '',
      listedIn: paper.listedIn || '',
      ugcListNo: paper.ugcListNo || '',
      citations: paper.citations || '',
      impactFactor: paper.impactFactor || '',
      webUrl: paper.webUrl || ''
    })),
    experience: (apiData.experience || []).map((exp) => ({
      id: exp.id,
      supId: exp.supId,
      organizationName: exp.organizationName || '',
      designation: exp.designation || '',
      dateFrom: exp.dateFrom || '',
      dateTo: exp.dateTo || null,
      natureOfDuties: exp.natureOfDuties || '',
      resExperience: exp.resExperience || '',
      category: exp.category || '',
      areaOfSpec: exp.areaOfSpec || '',
      doc: exp.doc || null
    }))
  };

  // Add transaction details only if requested and available
  if (includeTransaction && apiData.transaction) {
    transformedData.transactionDetails = {
      txnId: apiData.transaction.txnNo || '',
      amount: apiData.transaction.totalFee || '0.00',
      txnDate: formatDate(apiData.transaction.txnDate),
      status: apiData.transaction.status || ''
    };
  }

  return transformedData;
};