import { useEffect, useState } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DatePicker } from 'antd';
import API from '@/services/API';
import useStepSupStore from '../components/stepStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import dayjs from 'dayjs';

const PersonalInfo = () => {
  const navigate = useNavigate();
  const fetchSteps = useStepSupStore(state => state.fetchSteps);
  const isStepReadOnly = useStepSupStore(state => state.isStepReadOnly);
  const checkScreeningStatus = useStepSupStore(state => state.checkScreeningStatus);
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  console.log(supId);
  const [supervisorData, setSupervisorData] = useState(null);

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
  const isReadOnly = supervisorData ? isStepReadOnly(1, supervisorData) : false; // Step 1 is Personal Info

  // Field-specific read-only states
  const [fieldReadOnlyStates, setFieldReadOnlyStates] = useState({
    title: false,
    fullName: false,
    fatherName: false
  });

  const [state, setState] = useState([]);
  const [district, setDistrict] = useState([]);
  const [designation, setDesignation] = useState([]);
  const [document, setdocument] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [apaarDocument, setApaarDocument] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    supId,
    fullName: "",
    fatherName: "",
    dateOfBirth: null,
    retirementDate: null,
    gender: "",
    designation: 0,
    nationality: "",
    IfOtherPleaseSpecify: "",
    identityProofType: 0,
    identityProofNo: "",
    apaarId: "",
    coAddress: "",
    coState: "",
    coDistrict: "",
    coPinCode: "",
    sameAsCorrespondence: false,
    peAddress: "",
    peState: "",
    peDistrict: "",
    pePinCode: "",
  });

  useEffect(() => {
    handleGetState();
    handleGetDesignation();
    handleGetReg();
    handleGetRegWithPers();
    handleGetDocument();
  }, []);

  // Effect to set selectedDocument when both document list and identityProofType are available
  useEffect(() => {
    if (formData.identityProofType && document.length > 0 && !selectedDocument) {
      const doc = document.find(
        (d) => d.documentMasterID === formData.identityProofType
      );
      if (doc) {
        setSelectedDocument(doc);
        console.log("Selected document from useEffect:", doc);
      } else {
        console.warn("Document not found for identityProofType:", formData.identityProofType);
        // Create a fallback document object to allow editing
        setSelectedDocument({
          documentMasterID: formData.identityProofType,
          documentName: "Document",
          validationRules: {
            minLength: 1,
            maxLength: 50,
            isAlphanumeric: false,
            isSpecialCharacterAllowed: true
          }
        });
      }
    }
  }, [formData.identityProofType, document, selectedDocument]);
  // Get max length for identity proof based on type
  const handleIdentityProofTypeChange = (e) => {
    const selectedId = Number(e.target.value);

    const doc = document.find(
      (d) => d.documentMasterID === selectedId
    );

    setFormData((prev) => ({
      ...prev,
      identityProofType: selectedId,
      identityProofNo: "",
    }));

    setSelectedDocument(doc);
  };

  const handleIdentityProofChange = (e) => {
    let value = e.target.value;

    if (!selectedDocument) return;

    const {
      isAlphanumeric,
      isSpecialCharacterAllowed,
      maxLength,
    } = selectedDocument.validationRules;

    // Remove special characters if not allowed
    if (!isSpecialCharacterAllowed) {
      value = value.replace(/[^a-zA-Z0-9]/g, "");
    }

    // Allow only alphanumeric
    if (isAlphanumeric) {
      value = value.replace(/[^a-zA-Z0-9]/g, "");
    }

    // Enforce max length
    if (maxLength) {
      value = value.slice(0, maxLength);
    }

    setFormData((prev) => ({
      ...prev,
      identityProofNo: value,
    }));
  };



  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle APAAR ID validation - use validation rules from DocumentMaster API
    if (name === "apaarId") {
      if (!apaarDocument) return;

      let processedValue = value;
      const {
        isAlphanumeric,
        isSpecialCharacterAllowed,
        maxLength,
      } = apaarDocument.validationRules;

      // Remove special characters if not allowed
      if (!isSpecialCharacterAllowed) {
        processedValue = processedValue.replace(/[^a-zA-Z0-9]/g, "");
      }

      // Allow only alphanumeric
      if (isAlphanumeric) {
        processedValue = processedValue.replace(/[^a-zA-Z0-9]/g, "");
      }

      // Enforce max length
      if (maxLength) {
        processedValue = processedValue.slice(0, maxLength);
      }

      setFormData((prev) => ({
        ...prev,
        apaarId: processedValue,
      }));
      return;
    }

    // Handle identity proof number validation
    if (name === "identityProofNo" && formData.identityProofType) {
      const maxLength = getIdentityProofMaxLength(formData.identityProofType);
      if (value.length > maxLength) {
        return; // Don't update if exceeds max length
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Date of Birth cannot be today or future
    if (name === "dateOfBirth") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dob = value.toDate();
      dob.setHours(0, 0, 0, 0);

      // Check if DOB is today or in the future
      if (dob >= today) {
        notification().warning("Date of Birth cannot be today or a future date");
        return;
      }

      // Check if person is at least 23 years old
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const dayDiff = today.getDate() - dob.getDate();

      // Adjust age if birthday hasn't occurred this year
      const actualAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;

      if (actualAge < 23) {
        notification().warning("Applicant must be at least 23 years old");
        return;
      }
    }

    if (name === "dateOfBirth" && formData.retirementDate) {
      const dob = value.toDate();
      const retirementDate = formData.retirementDate.toDate();

      if (dob >= retirementDate) {
        notification().warning("Date of Birth must be earlier than Date of Retirement");
        return;
      }
    }

    if (name === "retirementDate" && formData.dateOfBirth && value) {
      const dob = formData.dateOfBirth.toDate();
      const retirementDate = value.toDate();

      if (retirementDate <= dob) {
        notification().warning("Date of Retirement must be later than Date of Birth");
        return;
      }
    }
    if (name === "coState") {
      handleGetCity(value); // this now works properly
      setFormData((prev) => ({
        // ensure formData is updated also
        ...prev,
        coState: value,
      }));
      return;
    }

    if (name === "sameAsCorrespondence" && checked) {
      setFormData((prev) => ({
        ...prev,
        peAddress: prev.coAddress,
        peState: prev.coState,
        peDistrict: prev.coDistrict,
        pePinCode: prev.coPinCode,
      }));
    }

    // Clear identity proof number when proof type changes
    if (name === "identityProofType") {
      setFormData((prev) => ({
        ...prev,
        identityProofNo: "",
      }));
    }

    // Auto-select Passport when nationality is other than INDIA
    if (name === "nationality") {
      if (value !== "INDIA" && value !== "") {
        setFormData((prev) => ({
          ...prev,
          nationality: value,
          identityProofType: "Passport",
          identityProofNo: "", // Clear the number when changing proof type
        }));
        return; // Early return to avoid double state update
      }
    }
  };

  const handleGetState = async () => {
    try {
      const response = await API.get(
        `/States/GetState`
      );
      setState(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleGetDocument = async () => {
    try {
      const response = await API.get(
        `/DocumentMaster`
      );
      const res = response.data.filter(r => r.docType == "ID");
      console.log("=== DOCUMENT MASTER API RESPONSE ===");
      console.log("All documents:", response.data);
      console.log("Filtered ID documents:", res);
      
      // Find APAAR ID document for validation rules
      const apaarDoc = response.data.find(doc => 
        doc.documentName && doc.documentName.toLowerCase().includes('apaar')
      );
      
      if (apaarDoc) {
        console.log("APAAR ID document found:", apaarDoc);
        console.log("APAAR ID validation rules:", apaarDoc.validationRules);
        setApaarDocument(apaarDoc);
      } else {
        // Fallback if APAAR document not found in API
        setApaarDocument({
          documentName: "APAAR ID",
          validationRules: {
            minLength: 12,
            maxLength: 12,
            isAlphanumeric: true,
            isSpecialCharacterAllowed: false
          }
        });
      }
      
      // Filter out APAAR ID from the dropdown options
      const filteredDocs = res.filter(doc => 
        !doc.documentName || !doc.documentName.toLowerCase().includes('apaar')
      );
      
      console.log("Documents for dropdown (APAAR filtered out):", filteredDocs);
      setdocument(filteredDocs);
    } catch (error) {
      console.log("Error fetching documents:", error);
    }
  };

  const handleGetCity = async (selectedstate) => {
    try {
      const response = await API.get(
        `/States/GetCitiesByStateName?stateName=${selectedstate}`
      );
      setDistrict(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleGetDesignation = async () => {
    try {
      const response = await API.get(
        `/Designations`
      );
      setDesignation(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleGetReg = async () => {
    try {
      const response = await API.get(
        `/SupervisorRegistration/${supId}`
      );

      // Store supervisor data for read-only check
      setSupervisorData(response.data);

      // Fields should always be editable after registration
      setFieldReadOnlyStates({
        title: false,
        fullName: false,
        fatherName: false
      });

      console.log("Field read-only states:", {
        title: false,
        fullName: false,
        fatherName: false
      });

      setFormData((prev) => ({
        ...prev,
        title: response.data.title || "",
        fullName: response.data.fullName || "",
        fatherName: response.data.fatherName || "",
      }));
    } catch (error) {
      console.log(error);
    }
  };

  // Handle date changes for DatePicker components
  const handleDateOfBirthChange = (date) => {
    if (!date) {
      setFormData(prev => ({ ...prev, dateOfBirth: null }));
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dob = date.toDate();
    dob.setHours(0, 0, 0, 0);

    // Check if DOB is today or in the future
    if (dob >= today) {
      notification().warning("Date of Birth cannot be today or a future date");
      return;
    }

    // Check if person is at least 23 years old
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();

    // Adjust age if birthday hasn't occurred this year
    const actualAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;

    if (actualAge < 23) {
      notification().warning("Applicant must be at least 23 years old");
      return;
    }

    // Check against retirement date if it exists
    if (formData.retirementDate) {
      const retirementDate = formData.retirementDate.toDate();
      if (dob >= retirementDate) {
        notification().warning("Date of Birth must be earlier than Date of Retirement");
        return;
      }
    }

    setFormData(prev => ({ ...prev, dateOfBirth: date }));
  };

  const handleRetirementDateChange = (date) => {
    if (!date) {
      setFormData(prev => ({ ...prev, retirementDate: null }));
      return;
    }

    // Check against date of birth if it exists
    if (formData.dateOfBirth) {
      const dob = formData.dateOfBirth.toDate();
      const retirementDate = date.toDate();

      if (retirementDate <= dob) {
        notification().warning("Date of Retirement must be later than Date of Birth");
        return;
      }
    }

    setFormData(prev => ({ ...prev, retirementDate: date }));
  };

  const handleGetRegWithPers = async () => {
    try {
      if (!supId) return;

      const response = await API.get(
        `/SupervisorPersonals/RegWithPers?id=${supId}`
      );
      const data = response.data;

      const isIndia =
        data.nationality &&
        data.nationality.toUpperCase() === "INDIA";
      // Assuming API returns: { reg: {...}, personal: {...} }
      setFormData((prev) => ({
        ...prev,
        title: data.title || "",
        fullName: data.fullName || "",
        fatherName: data.fatherName || "",
        dateOfBirth: data.dateOfBirth ? dayjs(data.dateOfBirth) : null,
        retirementDate: data.retirementDate ? dayjs(data.retirementDate) : null,
        gender: data.gender || "",
        designation: data.designation,
        nationality: isIndia ? "INDIA" : "Other",
        IfOtherPleaseSpecify: isIndia ? "" : data.nationality || "",
        identityProofType: data.identityProofType,
        identityProofNo: data.identityProofNo || "",
        apaarId: data.apaarId || "",
        coAddress: data.coAddress || "",
        coState: data.coState || "",
        coDistrict: data.coDistrict || "",
        coPinCode: data.coPinCode || "",
        peAddress: data.peAddress || "",
        peState: data.peState || "",
        peDistrict: data.peDistrict || "",
        pePinCode: data.pePinCode || "",
      }));

      // Set selectedDocument based on the fetched identityProofType
      if (data.identityProofType && document.length > 0) {
        const doc = document.find(
          (d) => d.documentMasterID === data.identityProofType
        );
        if (doc) {
          setSelectedDocument(doc);
          console.log("Selected document from API data:", doc);
        } else {
          console.warn("Document not found for identityProofType:", data.identityProofType);
          // If document not found, still allow editing by creating a basic document object
          setSelectedDocument({
            documentMasterID: data.identityProofType,
            documentName: "Unknown Document",
            validationRules: {
              minLength: 1,
              maxLength: 50,
              isAlphanumeric: false,
              isSpecialCharacterAllowed: true
            }
          });
        }
      }
      if (data.coState) {
        handleGetCity(data.coState, () => {
          setFormData((prev) => ({
            ...prev,
            coDistrict: data.coDistrict || "",
          }));
        });
      }

      if (data.peState) {
        handleGetCity(data.peState, () => {
          setFormData((prev) => ({
            ...prev,
            peDistrict: data.peDistrict || "",
          }));
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isReadOnly) {
      return; // Silently prevent submission when read-only
    }

    if (!supId) {
      notification().error("User session expired. Please login again.");
      return;
    }

    const filteredData = { ...formData };

    // Convert dayjs objects to ISO strings for API
    if (filteredData.dateOfBirth) {
      filteredData.dateOfBirth = filteredData.dateOfBirth.toISOString();
    }
    if (filteredData.retirementDate) {
      filteredData.retirementDate = filteredData.retirementDate.toISOString();
    } else {
      filteredData.retirementDate = null;
    }
    // Handle nationality: if not INDIA, use the specified nationality
    if (
      filteredData.nationality === "Other" &&
      filteredData.IfOtherPleaseSpecify
    ) {
      filteredData.nationality = filteredData.IfOtherPleaseSpecify;
    }

    // Remove temporary fields but keep title, fullName, fatherName for the API
    delete filteredData.sameAsCorrespondence;
    delete filteredData.IfOtherPleaseSpecify;

    try {
      const response = await API.post(
        "/SupervisorPersonals",
        filteredData
      );

      console.log("Personal info saved successfully:", response.data);
      notification().success("Personal information saved successfully!");

      // Refresh steps and navigate only on success
      setTimeout(async () => {
        try {
          const steps = await fetchSteps(supId);
          if (steps) {
            navigate(SUPERVISOR_REGISTRATION_ROUTES.EDUCATIONAL_DETAILS);
          } else {
            notification().error("Failed to update step progress. Please try again.");
          }
        } catch (error) {
          console.error("Error fetching steps:", error);
          notification().error("Failed to update step progress. Please try again.");
        }
      }, 1500);

    } catch (err) {
      console.error("Error saving personal info:", err);
      if (err.response?.data?.message) {
        notification().error(`Error: ${err.response.data.message}`);
      } else {
        notification().error("Failed to save personal information. Please try again.");
      }
    }
  };

  // Helper function to calculate date limits for DatePicker
  const getDateLimits = () => {
    const today = dayjs();

    // Maximum allowed DOB: exactly 23 years ago from today
    const maxDate = today.subtract(23, 'year').subtract(1, 'day');

    const minDate = today.subtract(80, 'year'); // Assuming max age of 80

    return {
      min: minDate,
      max: maxDate
    };
  };
  const getFieldInputClass = (fieldName) => {
    const isFieldReadOnly = fieldReadOnlyStates[fieldName] || isReadOnly;
    return `w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm ${isFieldReadOnly ? 'bg-amber-50 cursor-not-allowed border-amber-300 text-amber-800' : ''
      }`;
  };

  const inputClass = `w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm ${isReadOnly ? 'bg-amber-50 cursor-not-allowed border-amber-300 text-amber-800' : ''
    }`;
  const labelClass = "block text-sm font-medium text-[#374151] mb-1 font-inter";

  return (
    <div className="p-4 md:p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Information */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="flex-1">
                <label className={labelClass}>
                  Salutation<span className="text-red-600">*</span>
                  {fieldReadOnlyStates.title && (
                    <span className="text-xs text-amber-600 ml-2"></span>
                  )}
                </label>
                <select
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={getFieldInputClass('title')}
                  disabled={fieldReadOnlyStates.title || isReadOnly}
                  required
                >
                  <option value="">Select Salutation</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                </select>
              </div>

              <div className="flex-1">
                <label className={labelClass}>
                  Name of the Applicant<span className="text-red-600">*</span>
                  {fieldReadOnlyStates.fullName && (
                    <span className="text-xs text-amber-600 ml-2"></span>
                  )}
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={getFieldInputClass('fullName')}
                  placeholder="Enter Applicant Name"
                  disabled={fieldReadOnlyStates.fullName || isReadOnly}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Name of Father<span className="text-red-600">*</span>
                {fieldReadOnlyStates.fatherName && (
                  <span className="text-xs text-amber-600 ml-2"></span>
                )}
              </label>
              <input
                type="text"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
                className={getFieldInputClass('fatherName')}
                placeholder="Enter father's name"
                disabled={fieldReadOnlyStates.fatherName || isReadOnly}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                Date of Birth (dd/mm/yyyy)
                <span className="text-red-600">*</span>
              </label>
              <DatePicker
                value={formData.dateOfBirth}
                onChange={handleDateOfBirthChange}
                className={inputClass}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="Select date of birth"
                minDate={getDateLimits().min}
                maxDate={getDateLimits().max}
                disabled={isReadOnly}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 23 years old
              </p>
            </div>

            {/* <div>
              <label className={labelClass}>
                Date of Retirement (dd/mm/yyyy)
              </label>
              <DatePicker
                value={formData.retirementDate}
                onChange={handleRetirementDateChange}
                className={inputClass}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="Select retirement date"
                minDate={dayjs().add(1, 'day')}
                disabled={isReadOnly}
              />
            </div> */}

            <div>
              <label className={labelClass}>
                Gender<span className="text-red-600">*</span>
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className={inputClass}
                disabled={isReadOnly}
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Designation<span className="text-red-600">*</span>
              </label>
              <select
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className={inputClass}
                disabled={isReadOnly}
                required
              >
                <option value="">Select</option>
                {designation.map((item) => (
                  <option key={item.designationID} value={item.designationID}>
                    {item.designationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Country/Nationality<span className="text-red-600">*</span>
              </label>
              <select
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className={inputClass}
                disabled={isReadOnly}
                maxLength="50"
                required
              >
                <option value="">Select Nationality</option>
                <option value="INDIA">INDIA</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {formData.nationality && formData.nationality !== "INDIA" && (
              <div>
                <label className={labelClass}>
                  If Other Please Specify Natonality
                  <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="IfOtherPleaseSpecify"
                  value={formData.IfOtherPleaseSpecify}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                />
              </div>
            )}

            <div>
              <label className={labelClass}>
                Identity Proof<span className="text-red-600">*</span>
              </label>
              <select
                name="identityProofType"
                value={formData.identityProofType}
                onChange={handleIdentityProofTypeChange}
                className={inputClass}
                disabled={isReadOnly}
                required
              >
                <option value="">Select Identity Proof</option>
                {document.map((item) => (
                  <option key={item.documentMasterID} value={item.documentMasterID}>
                    {item.documentName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Identity Proof No.<span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="identityProofNo"
                value={formData.identityProofNo}
                onChange={handleIdentityProofChange}
                className={inputClass}

                placeholder={
                  selectedDocument
                    ? `Enter ${selectedDocument.documentName.toLowerCase()} number`
                    : "Select identity proof type first"
                }
                maxLength={selectedDocument?.validationRules?.maxLength}
                minLength={selectedDocument?.validationRules?.minLength}
                required
                disabled={!selectedDocument || isReadOnly}
              />

              {selectedDocument && (
                <p className="text-xs text-gray-500 mt-1">
                  Min length: {selectedDocument.validationRules.minLength}, Max length:{" "}
                  {selectedDocument.validationRules.maxLength}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>APAAR ID<span className="text-red-600">*</span></label>
              <input
                type="text"
                name="apaarId"
                value={formData.apaarId}
                onChange={handleChange}
                className={inputClass}
                placeholder={
                  apaarDocument
                    ? `Enter ${apaarDocument.documentName}`
                    : "Enter APAAR ID"
                }
                disabled={!apaarDocument || isReadOnly}
                inputMode="numeric"
                minLength={apaarDocument?.validationRules?.minLength}
                maxLength={apaarDocument?.validationRules?.maxLength}
                required
              />
              {apaarDocument && (
                <p className="text-xs text-gray-500 mt-1">
                  Min length: {apaarDocument.validationRules.minLength}, Max length:{" "}
                  {apaarDocument.validationRules.maxLength}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Correspondence Address */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Correspondence Address
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className={labelClass}>
                Address<span className="text-red-600">*</span>
              </label>
              <textarea
                name="coAddress"
                value={formData.coAddress}
                onChange={handleChange}
                rows="2"
                className={inputClass + " resize-none"}
                placeholder="Enter correspondence address"
                disabled={isReadOnly}
                required
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  State<span className="text-red-600">*</span>
                </label>
                <select
                  name="coState"
                  value={formData.coState}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                >
                  <option value="">Select State</option>
                  {state.map((s, index) => (
                    <option key={index} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  District<span className="text-red-600">*</span>
                </label>
                <select
                  name="coDistrict"
                  value={formData.coDistrict}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isReadOnly}
                  required
                >
                  <option value="">Select District</option>
                  {district.map((s, index) => (
                    <option key={index} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Pincode<span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="coPinCode"
                  value={formData.coPinCode}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter pincode"
                  disabled={isReadOnly}
                  maxLength="6"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Same as Correspondence Checkbox */}
        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            name="sameAsCorrespondence"
            checked={formData.sameAsCorrespondence}
            onChange={handleChange}
            className={`w-4 h-4 border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af] ${isReadOnly
              ? 'text-amber-600 bg-amber-50 border-amber-300 cursor-not-allowed'
              : 'text-[#1e40af]'
              }`}
            disabled={isReadOnly}
          />
          <label className="text-sm font-medium text-[#374151] font-inter">
            Permanent Address is same as Correspondence Address
          </label>
        </div>

        {/* Permanent Address */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-2 pb-2 border-b-2 border-[#1e40af] font-inter">
            Permanent Address
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className={labelClass}>
                Address<span className="text-red-600">*</span>
              </label>
              <textarea
                name="peAddress"
                value={formData.peAddress}
                onChange={handleChange}
                rows="2"
                className={inputClass + " resize-none"}
                placeholder="Enter permanent address"
                disabled={formData.sameAsCorrespondence || isReadOnly}
                required
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  State<span className="text-red-600">*</span>
                </label>
                <select
                  name="peState"
                  value={formData.peState}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={formData.sameAsCorrespondence || isReadOnly}
                  required
                >
                  <option value="">Select State</option>
                  {state.map((s, index) => (
                    <option key={index} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  District<span className="text-red-600">*</span>
                </label>
                <select
                  name="peDistrict"
                  value={formData.peDistrict}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={formData.sameAsCorrespondence || isReadOnly}
                  required
                >
                  <option value="">Select District</option>
                  {district.map((s, index) => (
                    <option key={index} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Pincode<span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="pePinCode"
                  value={formData.pePinCode}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Enter pincode"
                  maxLength="6"
                  disabled={formData.sameAsCorrespondence || isReadOnly}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
          <button
            type="submit"
            disabled={isReadOnly}
            className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${isReadOnly
              ? 'bg-amber-200 text-amber-800 cursor-not-allowed border border-amber-300'
              : 'bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] hover:shadow-lg'
              }`}
          >
            Save And Next
            <ChevronRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalInfo;
