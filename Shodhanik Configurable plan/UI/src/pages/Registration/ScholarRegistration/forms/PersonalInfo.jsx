import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';

const PersonalInfo = () => {

  const { getSId } = useScholarRegAuthStore();
  const { saveStep, isReadOnly } = useSteps();

  // Auto-refresh steps from API on component load
  useStepRefresh();

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    candidateName: '',
    fatherName: '',
    motherName: '',
    guardianName: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    nationality: '',
    passportNumber: '',
    apaarId: '',
    domicile: '',
    domicileOther: '',
    category: '',
    casteCertificateNo: '',
    issueDate: '',
    issuingAuthority: '',
    subCategory: '',
    identityProof: '',
    identityProofNumber: '',
    correspondenceAddress: '',
    correspondenceState: '',
    correspondenceDistrict: '',
    correspondencePincode: '',
    sameAsCorrespondence: false,
    permanentAddress: '',
    permanentState: '',
    permanentDistrict: '',
    permanentPincode: '',
    examPreference1: '',
    examPreference2: '',
    onlineExamAbroad: false,
    onlineExamCity: '',
    isSingleParent: false,
    isWorking:false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scholarData, setScholarData] = useState(null);
  const [personalDetails, setPersonalDetails] = useState(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [domicileStates, setDomicileStates] = useState([]);
  const [addressStates, setAddressStates] = useState([]);
  const [correspondenceDistricts, setCorrespondenceDistricts] = useState([]);
  const [permanentDistricts, setPermanentDistricts] = useState([]);
  const [identityProofOptions, setIdentityProofOptions] = useState([]);
  const [selectedDocumentRules, setSelectedDocumentRules] = useState(null);

  // Centralized SID management - later this will come from store
  const SID = getSId();

  // Sample data for dropdowns (will be replaced with API calls later)
  const sampleData = {
    genders: ['Male', 'Female', 'Transgender'],
    maritalStatuses: ['Unmarried', 'Married'],
    nationalities: ['INDIA', 'Other'],
    // domiciles, states, and districts will be fetched from API
    categories: ['General', 'Other Backward Class (OBC)', 'Scheduled Caste (SC)', 'Scheduled Tribe (ST)'],
    subCategories: ['Physically Handicapped/Divyangjan', 'Dependents of Freedom Fighters', 'Defence Person (Self)', 'Not Applicable', 'EWS', 'Female'],
    identityProofs: ['Aadhar Card', 'Driving License', 'Voter ID', 'Passport', 'PAN Card', 'APAAR ID'],
    examCities: ['Bareilly', 'Lucknow']
  };

  // Fetch identity proof options based on nationality
  const fetchIdentityProofOptions = async (nationality) => {
    try {
      let endpoint = '/DocumentMaster/GetDocuments?docType=id';

      if (nationality === 'INDIA') {
        // For Indian nationals
        endpoint = '/DocumentMaster/GetDocuments?docType=id';
      } else {
        // For NRI/Other nationals
        endpoint = '/DocumentMaster/GetDocuments?docType=id&NRI=nri';
      }

      const response = await API.get(endpoint);
      if (response.data && Array.isArray(response.data)) {
        setIdentityProofOptions(response.data);
      }
    } catch (error) {
      console.error('Error fetching identity proof options:', error);
      // Fallback to sample data
      setIdentityProofOptions([
        {
          documentMasterID: 1,
          documentName: 'Aadhar Card',
          validationRules: { minLength: 12, maxLength: 12, isAlphanumeric: false }
        },
        {
          documentMasterID: 2,
          documentName: 'Passport',
          validationRules: { minLength: 8, maxLength: 9, isAlphanumeric: true }
        }
      ]);
    }
  };

  // Dynamic validation based on API rules
  const validateIdentityProof = (proofNumber, rules) => {
    if (!rules || !proofNumber) return false;

    const { minLength, maxLength, isAlphanumeric, isSpecialCharacterAllowed } = rules;

    // Check length - handle both undefined and 0 values properly
    if (typeof minLength === 'number' && proofNumber.length < minLength) {
      return false;
    }
    if (typeof maxLength === 'number' && proofNumber.length > maxLength) {
      return false;
    }
    
    // For exact length requirements (like APAAR ID with 12 characters)
    if (typeof minLength === 'number' && typeof maxLength === 'number' && minLength === maxLength && proofNumber.length !== minLength) {
      return false;
    }

    // Check character type
    if (isAlphanumeric === false) {
      // Only numbers allowed
      if (!/^\d+$/.test(proofNumber)) {
        return false;
      }
    } else if (isAlphanumeric === true) {
      // Alphanumeric allowed
      if (!/^[A-Za-z0-9]+$/.test(proofNumber)) {
        return false;
      }
    }

    // Check special characters (only if explicitly defined)
    if (isSpecialCharacterAllowed === false) {
      if (/[^A-Za-z0-9]/.test(proofNumber)) {
        return false;
      }
    }

    return true;
  };

  const validateAge = (dateOfBirth) => {
    if (!dateOfBirth) return false;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const isUnder18 = (dateOfBirth) => {
    const age = validateAge(dateOfBirth);
    return age !== false && age < 18;
  };

  const isAtLeast18 = (dateOfBirth) => {
    const age = validateAge(dateOfBirth);
    return age !== false && age >= 18;
  };

  // Get max date for DOB (no restriction now since under 18 is allowed with guardian)
  const getMaxDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get placeholder text based on selected document rules
  const getPlaceholderText = () => {
    if (!selectedDocumentRules) return 'Enter identity proof number';

    const { minLength, maxLength, isAlphanumeric } = selectedDocumentRules;
    const lengthText = minLength === maxLength ? `${minLength}` : `${minLength}-${maxLength}`;
    const typeText = isAlphanumeric ? 'alphanumeric' : 'numeric';

    return `Enter ${lengthText} ${typeText} characters`;
  };

  // Get format hint based on selected document rules
  const getFormatHint = () => {
    if (!selectedDocumentRules) return '';

    const { minLength, maxLength, isAlphanumeric, isSpecialCharacterAllowed } = selectedDocumentRules;
    const lengthText = minLength === maxLength ? `${minLength} characters` : `${minLength}-${maxLength} characters`;
    const typeText = isAlphanumeric ? 'letters and numbers' : 'numbers only';
    const specialText = isSpecialCharacterAllowed ? ', special characters allowed' : ', no special characters';

    return `Format: ${lengthText}, ${typeText}${specialText}`;
  };

  // Fetch districts based on selected state
  const fetchDistricts = async (stateName, isCorrespondence = true) => {
    try {
      const response = await API.get(`/States/GetCitiesByStateName?stateName=${encodeURIComponent(stateName)}`);
      if (response.data && Array.isArray(response.data)) {
        // Clean up district names (remove leading spaces)
        const cleanedDistricts = response.data.map(district => district.trim());

        if (isCorrespondence) {
          setCorrespondenceDistricts(cleanedDistricts);
        } else {
          setPermanentDistricts(cleanedDistricts);
        }
      }
    } catch (error) {
      console.error('Error fetching districts:', error);
      // Use fallback data if API fails
      const fallbackDistricts = ['Bareilly', 'Lucknow', 'Agra'];
      if (isCorrespondence) {
        setCorrespondenceDistricts(fallbackDistricts);
      } else {
        setPermanentDistricts(fallbackDistricts);
      }
    }
  };



  // Fetch scholar data and personal details on component mount
  useEffect(() => {
    const fetchData = async () => {
      const notify = notification();

      try {
        setIsLoading(true);

        // Fetch states data for both domicile and address
        try {
          const statesResponse = await API.get('/States/GetState');
          if (statesResponse.data && Array.isArray(statesResponse.data)) {
            setDomicileStates(statesResponse.data);
            setAddressStates(statesResponse.data); // Same states for address
          }
        } catch (statesError) {
          console.error('Error fetching states:', statesError);
          // Use fallback data if API fails
          const fallbackStates = ['Uttar Pradesh', 'Delhi', 'Maharashtra'];
          setDomicileStates(fallbackStates);
          setAddressStates(fallbackStates);
        }

        // Fetch scholar basic data
        const scholarResponse = await API.get(`/Scholars/${SID}`);
        if (scholarResponse.data) {
          setScholarData(scholarResponse.data);
        }

        // Initialize identity proof options with default (Indian)
        await fetchIdentityProofOptions('INDIA');

        // Fetch existing personal details
        try {
          const personalResponse = await API.get(`/ScholarPersonalDetails/GetPersonalDetailBySID?sid=${SID}`);
          if (personalResponse.data) {
            const data = personalResponse.data;
            setPersonalDetails(data);
            setIsUpdateMode(true); // Set to update mode if data exists

            // Auto-populate form with existing personal details
            setFormData(prev => ({
              ...prev,
              candidateName: scholarResponse.data?.name || '', // Candidate name comes from scholar data
              fatherName: scholarResponse.data?.fName || '',
              motherName: data.mname || '', // mname is mother's name
              guardianName: data.guardianName || '',
              dateOfBirth: data.dob ? data.dob.split('T')[0] : '',
              gender: data.gender || '',
              maritalStatus: data.maritalStatus || '',
              nationality: data.country || '',
              passportNumber: data.passportNo || '',
              apaarId: data.apaarId || '',
              domicile: data.otherDomicile ? 'Other' : data.domicile || '',
              domicileOther: data.otherDomicile || '',
              category: data.category || '',
              casteCertificateNo: data.castCertificateNo || '',
              issueDate: data.issueDate ? data.issueDate.split('T')[0] : '',
              issuingAuthority: data.issuingAuthority || '',
              subCategory: data.subCategory || '',
              identityProof: data.identityProof || '',
              // For "Other" nationality, use passportNo as identityProofNumber; for Indian nationals, use identityProofNo
              identityProofNumber: data.country === 'Other' && data.passportNo ? data.passportNo : (data.identityProofNo || ''),
              correspondenceAddress: data.correspondenceAddress || '',
              correspondenceState: data.cState || '',
              correspondenceDistrict: data.cDistrict || '',
              correspondencePincode: data.cPincode || '',
              sameAsCorrespondence: data.permanentAddress === data.correspondenceAddress &&
                data.pState === data.cState &&
                data.pDistrict === data.cDistrict &&
                data.pPinCode === data.cPincode,
              permanentAddress: data.permanentAddress || '',
              permanentState: data.pState || '',
              permanentDistrict: data.pDistrict || '',
              permanentPincode: data.pPinCode || '',
              examPreference1: data.exPreference1 || '',
              examPreference2: data.exPreference2 || '',
              isSingleParent: !!data.guardianName, // Set single parent if guardian name exists
              isWorking: !!data.isWorking, // Set if working to get NOC , later in documents upload
            }));

            // Fetch identity proof options based on nationality
            if (data.country) {
              await fetchIdentityProofOptions(data.country);

              // Set selected document rules if identity proof is already selected
              // Use setTimeout to ensure identityProofOptions is updated
              setTimeout(() => {
                if (data.identityProof) {
                  const selectedDoc = identityProofOptions.find(doc => doc.documentName === data.identityProof);
                  if (selectedDoc) {
                    setSelectedDocumentRules(selectedDoc.validationRules);
                  }
                }
              }, 100);
            }

            // Fetch districts for pre-selected states
            if (data.cState) {
              await fetchDistricts(data.cState, true);
            }
            if (data.pState) {
              if (data.pState !== data.cState) {
                await fetchDistricts(data.pState, false);
              } else {
                // If same state, fetch districts for permanent as well
                await fetchDistricts(data.pState, false);
              }
            }
          }
        } catch (personalError) {
          // Personal details might not exist yet, that's okay - use POST mode
          console.log('No existing personal details found, starting fresh');
          setIsUpdateMode(false); // Set to create mode

          // Still populate basic info from scholar data
          if (scholarResponse.data) {
            setFormData(prev => ({
              ...prev,
              candidateName: scholarResponse.data.name || '',
              fatherName: scholarResponse.data.fName || '',
            }));
          }
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        // notify.error('Error loading information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Set document rules when identity proof options change and form has existing identity proof
  useEffect(() => {
    if (identityProofOptions.length > 0 && formData.identityProof) {
      const selectedDoc = identityProofOptions.find(doc => doc.documentName === formData.identityProof);
      if (selectedDoc && selectedDoc.validationRules) {
        setSelectedDocumentRules(selectedDoc.validationRules);
      }
    }
  }, [identityProofOptions, formData.identityProof]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const notify = notification();

    // Handle caste certificate number - only allow 12 digits
    if (name === 'casteCertificateNo') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, '');
      
      // Limit to 12 digits
      if (digitsOnly.length <= 12) {
        setFormData(prev => ({
          ...prev,
          [name]: digitsOnly
        }));
        
        // Show validation feedback
        if (digitsOnly.length > 0 && digitsOnly.length < 12) {
          // Silently allow partial input during typing
        } else if (digitsOnly.length === 12) {
          // Valid - 12 digits entered
        }
      }
      return;
    }

    // Handle single parent checkbox
    if (name === 'isSingleParent') {
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        motherName: checked ? '' : prev.motherName, // Clear mother name if single parent
        guardianName: checked ? prev.guardianName : '' // Clear guardian name if not single parent
      }));
      return;
    }
    // Handle isWorking checkbox
    if (name === 'isWorking') {
      setFormData(prev => ({
        ...prev,
        isWorking: checked
      }));
      return;
    }

    // Validate DOB - no minimum age restriction now, but show warning for under 18
    // if (name === 'dateOfBirth' && value) {
    //   const age = validateAge(value);
    //   if (age !== false && age < 18) {
    //     notify.warning('Candidate is under 18 years old. Guardian information will be required.');
    //   }
    // }

    // Handle nationality change - fetch identity proof options
    if (name === 'nationality' && value) {
      fetchIdentityProofOptions(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        identityProof: '', // Clear identity proof when nationality changes
        identityProofNumber: '', // Clear identity proof number
        apaarId: '' // Clear APAAR ID when nationality changes
      }));
      setSelectedDocumentRules(null);
      return;
    }

    // Handle identity proof selection - set validation rules
    if (name === 'identityProof' && value) {
      const selectedDoc = identityProofOptions.find(doc => doc.documentName === value);
      if (selectedDoc) {
        setSelectedDocumentRules(selectedDoc.validationRules);
      }
      setFormData(prev => ({
        ...prev,
        [name]: value,
        identityProofNumber: '' // Clear the number when type changes
      }));
      return;
    }

    // Validate identity proof number with dynamic rules
    if (name === 'identityProofNumber' && value && selectedDocumentRules) {
      const isValid = validateIdentityProof(value, selectedDocumentRules);
      
      if (!isValid && value.length > 0) {
        const { minLength, maxLength } = selectedDocumentRules;
        const currentLength = value.length;
        
        // Show real-time validation feedback for certain cases
        if (minLength === maxLength && currentLength > minLength) {
          notify.warning(`${formData.identityProof} must be exactly ${minLength} characters.`);
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (name === 'sameAsCorrespondence' && checked) {
      setFormData(prev => ({
        ...prev,
        permanentAddress: prev.correspondenceAddress,
        permanentState: prev.correspondenceState,
        permanentDistrict: prev.correspondenceDistrict,
        permanentPincode: prev.correspondencePincode,
      }));
      // Copy correspondence districts to permanent districts
      setPermanentDistricts(correspondenceDistricts);
    }



    // Clear caste certificate fields when category changes to General
    if (name === 'category' && value === 'General') {
      setFormData(prev => ({
        ...prev,
        casteCertificateNo: '',
        issueDate: '',
        issuingAuthority: ''
      }));
    }

    // Clear EWS subcategory if category changes from General to something else
    if (name === 'category' && value !== 'General') {
      setFormData(prev => ({
        ...prev,
        subCategory: prev.subCategory === 'EWS' ? '' : prev.subCategory
      }));
    }

    // Fetch districts when correspondence state changes
    if (name === 'correspondenceState' && value) {
      fetchDistricts(value, true);
      // Clear selected district when state changes
      setFormData(prev => ({
        ...prev,
        correspondenceDistrict: ''
      }));
    }

    // Fetch districts when permanent state changes
    if (name === 'permanentState' && value) {
      fetchDistricts(value, false);
      // Clear selected district when state changes
      setFormData(prev => ({
        ...prev,
        permanentDistrict: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const notify = notification();
    console.log('Notification service initialized:', typeof notify);

    // Validate age and guardian/mother requirement
    const candidateAge = validateAge(formData.dateOfBirth);
    const candidateIsUnder18 = candidateAge !== false && candidateAge < 18;
    
    if (formData.isSingleParent) {
      // Single parent is checked
      if (candidateIsUnder18 && !formData.guardianName) {
        notify.error('Guardian name is required for candidates under 18 years old when single parent is selected');
        setIsSubmitting(false);
        return;
      }
      // If 18 or above and single parent, guardian name is not required
    } else {
      // Single parent is NOT checked - Mother name is always required
      if (!formData.motherName) {
        notify.error('Mother name is required when single parent is not selected');
        setIsSubmitting(false);
        return;
      }
    }

    // Validate caste certificate number for non-General categories
    if (formData.category && formData.category !== 'General') {
      if (!formData.casteCertificateNo || formData.casteCertificateNo.length !== 12) {
        notify.error('Caste Certificate Number must be exactly 12 digits');
        setIsSubmitting(false);
        return;
      }
      if (!/^\d{12}$/.test(formData.casteCertificateNo)) {
        notify.error('Caste Certificate Number must contain only numeric digits');
        setIsSubmitting(false);
        return;
      }
    }

    // Validate identity proof format before submission (only for Indian nationals)
    if (formData.nationality === 'INDIA' && formData.identityProof && formData.identityProofNumber && selectedDocumentRules) {
      if (!validateIdentityProof(formData.identityProofNumber, selectedDocumentRules)) {
        const { minLength, maxLength } = selectedDocumentRules;
        const currentLength = formData.identityProofNumber.length;
        
        let errorMessage = `Please enter a valid identity proof number. ${getFormatHint()}`;
        
        // Provide more specific error message
        if (minLength === maxLength && currentLength !== minLength) {
          errorMessage = `${formData.identityProof} must be exactly ${minLength} characters. You entered ${currentLength} characters.`;
        } else if (currentLength < minLength) {
          errorMessage = `${formData.identityProof} must be at least ${minLength} characters. You entered ${currentLength} characters.`;
        } else if (currentLength > maxLength) {
          errorMessage = `${formData.identityProof} must be at most ${maxLength} characters. You entered ${currentLength} characters.`;
        }
        
        notify.error(errorMessage);
        setIsSubmitting(false);
        return;
      }
    }

    // Validate passport number for Other nationality
    if (formData.nationality === 'Other' && formData.identityProofNumber) {
      if (formData.identityProofNumber.length < 8 || formData.identityProofNumber.length > 9) {
        notify.error('Passport number must be 8-9 characters long');
        setIsSubmitting(false);
        return;
      }
      if (!/^[A-Za-z0-9]+$/.test(formData.identityProofNumber)) {
        notify.error('Passport number must contain only letters and numbers');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Show loading notification
      // console.log('Starting form submission...');
      // notify.loading('Saving personal information...');
      // console.log('Loading notification sent');

      // Prepare payload according to API structure - use PascalCase matching database columns
      const payload = {
        SID: SID, // Use centralized SID
        Mname: formData.isSingleParent ? "" : formData.motherName, // Mname is mother's name, empty if single parent
        GuardianName: (formData.isSingleParent && isUnder18(formData.dateOfBirth)) ? formData.guardianName : "", // Guardian name only if single parent AND under 18
        Dob: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : new Date().toISOString(),
        Gender: formData.gender,
        MaritalStatus: formData.maritalStatus,
        Country: formData.nationality,
        // Use identityProofNumber as passport number for "Other" nationality
        PassportNo: formData.nationality === 'Other' ? formData.identityProofNumber : (formData.passportNumber || ""),
        ApaarId: formData.nationality === 'INDIA' && formData.apaarId ? formData.apaarId : "",
        Domicile: formData.domicile === 'Other' ? formData.domicileOther : formData.domicile,
        OtherDomicile: formData.domicile === 'Other' ? formData.domicileOther : "",
        Category: formData.category,
        CastCertificateNo: formData.casteCertificateNo || "",
        IssueDate: formData.issueDate || "",
        IssuingAuthority: formData.issuingAuthority || "",
        SubCategory: formData.subCategory,
        // Identity proof fields only for Indian nationals
        IdentityProof: formData.nationality === 'INDIA' ? formData.identityProof : "",
        IdentityProofNo: formData.nationality === 'INDIA' ? formData.identityProofNumber : "",
        CorrespondenceAddress: formData.correspondenceAddress,
        CState: formData.correspondenceState,
        CDistrict: formData.correspondenceDistrict,
        CPincode: formData.correspondencePincode,
        PermanentAddress: formData.permanentAddress,
        PState: formData.permanentState,
        PDistrict: formData.permanentDistrict,
        PPinCode: formData.permanentPincode,
        IsWorking: formData.isWorking
      };

      // Add exam preferences only if regType is 1
      if (scholarData?.regType === 1) {
        payload.ExPreference1 = formData.examPreference1;
        payload.ExPreference2 = formData.examPreference2 || "";
      }

      // Add spdid for PUT request if in update mode
      if (isUpdateMode && personalDetails?.spdid) {
        payload.SPDID = personalDetails.spdid;
      }

      console.log('Submitting payload:', payload);
      console.log('Mode:', isUpdateMode ? 'UPDATE (PUT)' : 'CREATE (POST)');

      let response;
      if (isUpdateMode && personalDetails?.spdid) {
        // Use PUT for updating existing record
        console.log('Making PUT request to:', `/ScholarPersonalDetails/${personalDetails.spdid}`);
        response = await API.put(`/ScholarPersonalDetails/${personalDetails.spdid}`, payload);
      } else {
        // Use POST for creating new record
        console.log('Making POST request to:', '/ScholarPersonalDetails');
        response = await API.post('/ScholarPersonalDetails', payload);
      }

      console.log('API Response:', response);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Check for successful response (multiple success conditions)
      const isSuccess = response && (
        (response.status >= 200 && response.status < 300) || // Standard success codes
        response.data || // Has response data
        !response.error // No error in response
      );

      if (isSuccess) {
        console.log('Success - showing notifications');

        try {
          notify.success('Personal information saved successfully!');
          console.log('Success notification sent');
        } catch (notifyError) {
          console.error('Error:', notifyError);
          notify.error('Personal information not saved successfully!'); // Fallback
        }

        // Complete step and navigate
        setTimeout(async () => {
          const stepSaved = await saveStep(1);
          if (stepSaved) {
            navigate('/register-scholar/educational-details');
          }
        }, 1500);
      } else {
        console.log('Unexpected response - Status:', response?.status, 'Data:', response?.data);
        try {
          notify.warning(`Data may have been saved. Response status: ${response?.status || 'unknown'}`);
        } catch (notifyError) {
          console.error('Error with warning notification:', notifyError);
          notify.error(`Data may have been saved. Response status: ${response?.status || 'unknown'}`); // Fallback
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);

      // Handle different error scenarios
      if (error.response?.data?.message) {
        notify.error(error.response.data.message);
      } else if (error.response?.status === 400) {
        notify.error('Please check your input data and try again.');
      } else if (error.response?.status === 500) {
        notify.error('Server error. Please try again later.');
      } else {
        notify.error('Error saving personal information. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm";
  const readOnlyInputClass = "w-full px-3 py-2 border border-[#d1d5db] rounded-md bg-gray-50 text-gray-600 font-inter text-sm cursor-not-allowed";
  const labelClass = "block text-sm font-medium text-[#374151] mb-1 font-inter";

  // Dynamic class based on form editability
  const getInputClass = (fieldReadOnly = false) => {
    if (isReadOnly || fieldReadOnly) {
      return readOnlyInputClass;
    }
    return inputClass;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-5 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af] mx-auto mb-2"></div>
          <p className="text-gray-600 font-inter">Loading scholar information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      {/* Debug Component - Remove in production */}

      {/* {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Read-only:</strong> Step 5 completed. Personal information cannot be modified.
          </p>
        </div>
      )} */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Information */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className={labelClass}>Name of the Candidate<span className="text-red-600">*</span></label>
              <input
                type="text"
                name="candidateName"
                value={formData.candidateName}
                onChange={handleChange}
                className={getInputClass(isUpdateMode)}
                placeholder="Enter candidate name"
                readOnly={isReadOnly || isUpdateMode}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Name of Father<span className="text-red-600">*</span></label>
              <input
                type="text"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
                className={getInputClass(isUpdateMode)}
                placeholder="Enter father's name"
                readOnly={isReadOnly || isUpdateMode}
                required
              />
            </div>

            {/* Single Parent Checkbox */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  name="isSingleParent"
                  checked={formData.isSingleParent}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]"
                  disabled={isReadOnly}
                />
                <label className="text-sm font-medium text-[#374151] font-inter">Single Parent</label>
              </div>
              {/* <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  name="isWorking"
                  checked={formData.isWorking}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]"
                  disabled={isReadOnly}
                />
                <label className="text-sm font-medium text-[#374151] font-inter">Working</label>
              </div> */}
            </div>
            {/* Mother Name or Guardian Name based on checkbox and age */}
            {!formData.isSingleParent ? (
              <div>
                <label className={labelClass}>Name of Mother<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  className={getInputClass()}
                  placeholder="Enter mother's name"
                  readOnly={isReadOnly}
                  required
                />
              </div>
            ) : (
              // Single parent is checked
              formData.dateOfBirth && isUnder18(formData.dateOfBirth) ? (
                // Under 18 and single parent - Guardian name required
                <div>
                  <label className={labelClass}>Guardian Name<span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder="Enter guardian's name (required for under 18)"
                    readOnly={isReadOnly}
                    required
                  />
                  {/* <p className="text-xs text-orange-600 mt-1">Guardian name is required for candidates under 18 years old</p> */}
                </div>
              ) : (
                // 18 or above and single parent - Guardian name not required, show optional field
                <div>
                  <label className={labelClass}>Guardian Name</label>
                  <input
                    type="text"
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder="Enter guardian's name (optional)"
                    readOnly={isReadOnly}
                  />
                  {/* <p className="text-xs text-gray-500 mt-1">Guardian name is optional for candidates 18 years or above</p> */}
                </div>
              )
            )}

            <div>
              <label className={labelClass}>Date of Birth (dd/mm/yyyy)<span className="text-red-600">*</span></label>
              <DatePicker
                value={formData.dateOfBirth ? dayjs(formData.dateOfBirth) : null}
                onChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    dateOfBirth: date ? date.format('YYYY-MM-DD') : ''
                  }));
                }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                className={`w-full ${isReadOnly ? 'ant-picker-disabled' : ''}`}
                disabled={isReadOnly}
                placeholder="Select date of birth"
                style={{ width: '100%' }}
              />
              {/* {formData.dateOfBirth && isUnder18(formData.dateOfBirth) && (
                <p className="text-xs text-orange-600 mt-1">Candidate is under 18 years old - Guardian information required</p>
              )} */}
            </div>

            <div>
              <label className={labelClass}>Gender<span className="text-red-600">*</span></label>
              <select name="gender" value={formData.gender} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Gender</option>
                {sampleData.genders.map((gender) => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Marital Status<span className="text-red-600">*</span></label>
              <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Marital Status</option>
                {sampleData.maritalStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Country/Nationality<span className="text-red-600">*</span></label>
              <select name="nationality" value={formData.nationality} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Nationality</option>
                {sampleData.nationalities.map((nationality) => (
                  <option key={nationality} value={nationality}>{nationality}</option>
                ))}
              </select>
            </div>



            <div>
              <label className={labelClass}>Domicile<span className="text-red-600">*</span></label>
              <select name="domicile" value={formData.domicile} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Domicile</option>
                {domicileStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>

            {formData.domicile === 'Other' && (
              <div>
                <label className={labelClass}>Specify Domicile<span className="text-red-600">*</span></label>
                <input type="text" name="domicileOther" value={formData.domicileOther} onChange={handleChange} className={getInputClass()} placeholder="Specify domicile" readOnly={isReadOnly} required />
              </div>
            )}

            <div>
              <label className={labelClass}>Category<span className="text-red-600">*</span></label>
              <select name="category" value={formData.category} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Category</option>
                {sampleData.categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Caste Certificate fields - Only show for non-General categories */}
            {formData.category && formData.category !== 'General' && (
              <>
                <div>
                  <label className={labelClass}>Caste Certificate No <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="casteCertificateNo"
                    value={formData.casteCertificateNo}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder="Enter 12-digit certificate number"
                    readOnly={isReadOnly}
                    inputMode="numeric"
                    maxLength="12"
                    required
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500">Format: 12 numeric digits only</p>
                    <p className={`text-xs font-medium ${formData.casteCertificateNo.length === 12 ? 'text-green-600' : 'text-gray-500'}`}>
                      {formData.casteCertificateNo.length}/12
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Issue Date<span className="text-red-600">*</span></label>
                  <DatePicker
                    value={formData.issueDate ? dayjs(formData.issueDate) : null}
                    onChange={(date) => {
                      setFormData(prev => ({
                        ...prev,
                        issueDate: date ? date.format('YYYY-MM-DD') : ''
                      }));
                    }}
                    format="DD/MM/YYYY"
                    disabledDate={(current) => current && current > dayjs().endOf('day')}
                    className={`w-full ${isReadOnly ? 'ant-picker-disabled' : ''}`}
                    disabled={isReadOnly}
                    placeholder="Select issue date"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className={labelClass}>Issuing Authority<span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="issuingAuthority"
                    value={formData.issuingAuthority}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder="Enter issuing authority"
                    readOnly={isReadOnly}
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Sub-Category<span className="text-red-600">*</span></label>
              <select name="subCategory" value={formData.subCategory} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                <option value="">Select Sub-Category</option>
                {sampleData.subCategories
                  .filter((subCategory) => {
                    // Show EWS only for General category, hide for others
                    if (subCategory === 'EWS') {
                      return formData.category === 'General';
                    }
                    return true;
                  })
                  .map((subCategory) => (
                    <option key={subCategory} value={subCategory}>{subCategory}</option>
                  ))}
              </select>
            </div>

            {/* Identity Proof fields - Only show for Indian nationals */}
            {formData.nationality === 'INDIA' && (
              <>
                <div>
                  <label className={labelClass}>Identity Proof<span className="text-red-600">*</span></label>
                  <select 
                    name="identityProof" 
                    value={formData.identityProof} 
                    onChange={handleChange} 
                    className={getInputClass()} 
                    disabled={isReadOnly} 
                    required
                  >
                    <option value="">Select Identity Proof</option>
                    {identityProofOptions
                      .filter(doc => doc.documentName !== 'Passport' && doc.documentName !== 'APAAR ID') // Exclude Passport and APAAR ID from dropdown
                      .map((doc) => (
                        <option key={doc.documentMasterID} value={doc.documentName}>{doc.documentName}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Identity Proof No.<span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="identityProofNumber"
                    value={formData.identityProofNumber}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder={getPlaceholderText()}
                    readOnly={isReadOnly}
                    maxLength={selectedDocumentRules?.maxLength || undefined}
                    required
                  />
                  {formData.identityProof && selectedDocumentRules && (
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-500">{getFormatHint()}</p>
                      {selectedDocumentRules.minLength === selectedDocumentRules.maxLength && (
                        <p className="text-xs text-gray-500">
                          {formData.identityProofNumber.length}/{selectedDocumentRules.maxLength}
                        </p>
                      )}
                    </div>
                  )}
                  {formData.identityProof && !selectedDocumentRules && (
                    <p className="text-xs text-gray-500 mt-1">{getFormatHint()}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>APAAR ID<span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    name="apaarId"
                    value={formData.apaarId}
                    onChange={handleChange}
                    className={getInputClass()}
                    placeholder="Enter APAAR ID"
                    readOnly={isReadOnly}
                    minLength={12}
                    maxLength={12}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: 12 numeric characters</p>
                </div>
              </>
            )}

            {/* Passport field for Other nationality */}
            {formData.nationality === 'Other' && (
              <div>
                <label className={labelClass}>Passport No.<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="identityProofNumber"
                  value={formData.identityProofNumber}
                  onChange={handleChange}
                  className={getInputClass()}
                  placeholder="Enter passport number"
                  readOnly={isReadOnly}
                  minLength={8}
                  maxLength={9}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Format: 8-9 alphanumeric characters</p>
              </div>
            )}
          </div>
        </div>

        {/* Correspondence Address */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Correspondence Address
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className={labelClass}>Address<span className="text-red-600">*</span></label>
              <textarea name="correspondenceAddress" value={formData.correspondenceAddress} onChange={handleChange} rows="2" className={getInputClass() + " resize-none"} placeholder="Enter correspondence address" readOnly={isReadOnly} required />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>State<span className="text-red-600">*</span></label>
                <select name="correspondenceState" value={formData.correspondenceState} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                  <option value="">Select State</option>
                  {addressStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>District<span className="text-red-600">*</span></label>
                <select name="correspondenceDistrict" value={formData.correspondenceDistrict} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                  <option value="">Select District</option>
                  {correspondenceDistricts.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Pincode<span className="text-red-600">*</span></label>
                <input type="text" name="correspondencePincode" value={formData.correspondencePincode} onChange={handleChange} className={getInputClass()} placeholder="Enter pincode" maxLength="6" readOnly={isReadOnly} required />
              </div>
            </div>


          </div>
        </div>

        {/* Same as Correspondence Checkbox */}
        <div className="flex items-center gap-2 py-2">
          <input type="checkbox" name="sameAsCorrespondence" checked={formData.sameAsCorrespondence} onChange={handleChange} className="w-4 h-4 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]" disabled={isReadOnly} />
          <label className="text-sm font-medium text-[#374151] font-inter">Permanent Address is same as Correspondence Address</label>
        </div>

        {/* Permanent Address */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Permanent Address
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className={labelClass}>Address<span className="text-red-600">*</span></label>
              <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} rows="2" className={getInputClass() + " resize-none"} placeholder="Enter permanent address" disabled={isReadOnly || formData.sameAsCorrespondence} required />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>State<span className="text-red-600">*</span></label>
                <select name="permanentState" value={formData.permanentState} onChange={handleChange} className={getInputClass()} disabled={isReadOnly || formData.sameAsCorrespondence} required>
                  <option value="">Select State</option>
                  {addressStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>District<span className="text-red-600">*</span></label>
                <select name="permanentDistrict" value={formData.permanentDistrict} onChange={handleChange} className={getInputClass()} disabled={isReadOnly || formData.sameAsCorrespondence} required>
                  <option value="">Select District</option>
                  {permanentDistricts.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Pincode<span className="text-red-600">*</span></label>
                <input type="text" name="permanentPincode" value={formData.permanentPincode} onChange={handleChange} className={getInputClass()} placeholder="Enter pincode" maxLength="6" disabled={isReadOnly || formData.sameAsCorrespondence} required />
              </div>
            </div>
          </div>
        </div>

        {/* Exam Centre Preferences - Only show if regType is 1 */}
        {scholarData?.regType === 1 && (
          <div>
            <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
              Exam Centre City Preferences
            </h2>
            <p className="text-xs text-[#6b7280] mb-3 mt-2 font-inter">(Both will not Same. If Preference-1 is not available then Preference-2 will be given.)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Preference-1<span className="text-red-600">*</span></label>
                <select name="examPreference1" value={formData.examPreference1} onChange={handleChange} className={getInputClass()} disabled={isReadOnly} required>
                  <option value="">Select Preference-1</option>
                  {sampleData.examCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Preference-2</label>
                <select name="examPreference2" value={formData.examPreference2} onChange={handleChange} className={getInputClass()} disabled={isReadOnly}>
                  <option value="">Select Preference-2</option>
                  {sampleData.examCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Online Exam for Foreign Nationals */}
            <div className="mt-3 p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-md">
              <div className="flex items-start gap-2">
                <input type="checkbox" name="onlineExamAbroad" checked={formData.onlineExamAbroad} onChange={handleChange} className="w-4 h-4 mt-0.5 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]" disabled={isReadOnly} />
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#1e40af] font-inter block mb-2">
                    If you want Online Examination in Your country Please check this. (Only for Foreign Nationals.)
                  </label>
                  {formData.onlineExamAbroad && (
                    <input type="text" name="onlineExamCity" value={formData.onlineExamCity} onChange={handleChange} className={getInputClass()} placeholder="City & Country where you want to attend Online Exam" readOnly={isReadOnly} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
          <button
            type="submit"
            disabled={isSubmitting || isReadOnly}
            className="flex items-center gap-2 bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : isReadOnly ? 'Read Only' : 'Save And Next'}
            <ChevronRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalInfo;
