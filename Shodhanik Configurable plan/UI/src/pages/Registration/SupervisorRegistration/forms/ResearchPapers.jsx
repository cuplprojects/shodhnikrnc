import { useEffect, useState } from 'react';
import { Table, Input, DatePicker } from 'antd';
import { ChevronRight, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useStepSupStore from '../components/stepStore';
import useStepsSup from '../../../../hooks/useStepsSup';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import { useFileViewer } from '@/services/FileViewerService';
import dayjs from 'dayjs';

const ResearchPapers = () => {
  const baseFileURL = getBaseFileURL();
  const navigate = useNavigate();
  const { user, getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const { saveStep } = useStepsSup();
  const isStepReadOnly = useStepSupStore(state => state.isStepReadOnly);
  const checkScreeningStatus = useStepSupStore(state => state.checkScreeningStatus);
  const [supervisorData, setSupervisorData] = useState(null);
  const { FileViewerModal, openFile } = useFileViewer();

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

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [researchData, setResearchData] = useState([]);

  // Calculate isReadOnly after supervisorData is available
  const isReadOnly = supervisorData ? isStepReadOnly(4, supervisorData) : false; // Step 4 is Research Papers
  const [searchText, setSearchText] = useState('');
  const [formData, setFormData] = useState({
    supId,
    titleOfPaper: '',
    authorName: '',
    journalName: '',
    pubYear: null,
    issNo: '',
    volume: '',
    page: '',
    citations: '',
    impactFactor: '',
    webUrl: '',
    listedIn: '',
    ugcListNo: '',
    uploadPaper: '',
  });
  const [designation, setDesignation] = useState([]);
  const [totalResearchPaper, setTotalResearchPaper] = useState(0);
  const [editingKey, setEditingKey] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle decimal input for citations and impact factor
  const handleDecimalChange = (e) => {
    const { name, value } = e.target;

    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle ISSN input with uppercase conversion
  const handleISSNChange = (e) => {
    const { name, value } = e.target;

    // Convert to uppercase and update
    setFormData(prev => ({
      ...prev,
      [name]: value.toUpperCase()
    }));
  };

  const handleAddNew = () => {
    if (isFormVisible && !editingKey) {
      // If form is open and not editing, close it
      setIsFormVisible(false);
      setFormData({
        supId,
        titleOfPaper: '',
        authorName: '',
        journalName: '',
        pubYear: '',
        issNo: '',
        volume: '',
        page: '',
        citations: '',
        impactFactor: '',
        webUrl: '',
        listedIn: '',
        ugcListNo: '',
        uploadPaper: '',
      });
    } else {
      // Open form for adding new
      setIsFormVisible(true);
      setEditingKey(null);
      setFormData({
        supId,
        titleOfPaper: '',
        authorName: '',
        journalName: '',
        pubYear: '',
        issNo: '',
        volume: '',
        page: '',
        citations: '',
        impactFactor: '',
        webUrl: '',
        listedIn: '',
        ugcListNo: '',
        uploadPaper: '',
      });
    }
  };

  useEffect(() => {
    if (supId) {
      handleGetResearchData();
      handleGetAllResearchData();
      fetchSupervisorData();
      handleGetRegWithPers();
    }
  }, [supId]);

  // Log state changes for debugging
  useEffect(() => {
    console.log("=== STATE UPDATE ===");
    console.log("researchData.length:", researchData.length);
    console.log("totalResearchPaper:", totalResearchPaper);
    console.log("isReadOnly:", isReadOnly);
    console.log("Button should be disabled:", isReadOnly || researchData.length < totalResearchPaper);
  }, [researchData, totalResearchPaper, isReadOnly]);

  const fetchSupervisorData = async () => {
    try {
      const response = await API.get(`/SupervisorRegistration/${supId}`);
      setSupervisorData(response.data);
    } catch (error) {
      console.log('Error fetching supervisor data:', error);
    }
  };

  const handleGetRegWithPers = async () => {
    try {
      if (!supId) return;

      const response = await API.get(
        `/SupervisorPersonals/RegWithPers?id=${supId}`
      );
      const data = response.data;
      setDesignation(data.designation);

      // Fetch designation details to get totalResearchPaper
      if (data.designation) {
        fetchDesignationDetails(data.designation);
      }
    }
    catch (error) {
      console.log(error);
    }
  }

  const fetchDesignationDetails = async (designationId) => {
    try {
      const response = await API.get(`/Designations/${designationId}`);
      const data = response.data;
      const totalPapers = data.totalResearchPaper || 0;
      setTotalResearchPaper(totalPapers);
      console.log('Designation details:', data);
      console.log('Total research papers required:', totalPapers);
    } catch (error) {
      console.error('Error fetching designation details:', error);
      setTotalResearchPaper(0);
    }
  };

  const handleGetResearchData = async () => {
    try {
      if (!supId) return;

      const response = await API.get(
        `/SupervisorResearch/${supId}`
      );
      const data = response.data;

      // Assuming API returns: { reg: {...}, personal: {...} }
      setFormData((prev) => ({
        ...prev,
        titleOfPaper: data.titleOfPaper || '',
        authorName: data.authorName || '',
        journalName: data.journalName || '',
        pubYear: data.pubYear ? dayjs(data.pubYear, 'YYYY') : null,
        issNo: data.issNo || '',
        volume: data.volume || '',
        page: data.page || '',
        citations: data.citations || '',
        impactFactor: data.impactFactor || '',
        webUrl: data.webUrl || '',
        listedIn: data.listedIn || '',
        ugcListNo: data.ugcListNo || '',
        uploadPaper: data.uploadPaper || '',
      }));

    } catch (error) {
      console.log(error);
    }
  };
  const handleGetAllResearchData = async () => {
    try {
      if (!supId) {
        console.warn("No supId available");
        setResearchData([]);
        return;
      }

      console.log("Fetching research papers for supId:", supId);
      const response = await API.get(
        `/SupervisorResearch/Supervisor?supId=${supId}`
      );

      const data = response.data;

      console.log("=== RESEARCH PAPERS API RESPONSE ===");
      console.log("Full response data:", data);
      console.log("Data is array:", Array.isArray(data));
      console.log("Data length:", data?.length || 0);
      
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          console.log(`Paper ${index + 1}:`, item);
        });
      }

      // Convert API data → table format
      const formattedData = Array.isArray(data) ? data.map((item, index) => ({
        key: item.id,             // or any unique ID from backend
        srNo: index + 1,
        title: item.titleOfPaper,
        authorName: item.authorName,
        journalName: item.journalName,
        pubYear: item.pubYear,
        issNo: item.issNo,
        volume: item.volume,
        page: item.page,
        citations: item.citations,
        impactFactor: item.impactFactor,
        webUrl: item.webUrl,
        listedIn: item.listedIn,
        ugcListNo: item.ugcListNo,
        uploadPaper: item.uploadPaper
      })) : [];

      console.log("=== FORMATTED DATA FOR TABLE ===");
      console.log("Formatted data:", formattedData);
      console.log("Formatted data length:", formattedData.length);
      console.log("Total required:", totalResearchPaper);
      console.log("Button should be enabled:", formattedData.length >= totalResearchPaper);

      setResearchData(formattedData);   // store formatted rows
    } catch (error) {
      console.error("Error fetching research papers:", error);
      setResearchData([]); // Set empty array on error
    }
  };

  const handleSaveAndNext = async (e) => {
    if (isReadOnly) {
      return; // Silently prevent submission when read-only
    }

    // Check requirements based on designation using dynamic totalResearchPaper
    const requiredPapers = totalResearchPaper || 0;

    // Only show warning if they have fewer papers than required
    if (researchData.length < requiredPapers) {
      const papersNeeded = requiredPapers - researchData.length;
      notification().warning(`You need to add ${papersNeeded} more research paper${papersNeeded > 1 ? 's' : ''} to proceed. Currently you have ${researchData.length} paper${researchData.length !== 1 ? 's' : ''} added.`);
      return;
    }

    notification().success("Research papers section completed successfully!");
    setTimeout(async () => {
      const stepSaved = await saveStep(4);
      if (stepSaved) {
        navigate(SUPERVISOR_REGISTRATION_ROUTES.UPLOAD_DOCUMENTS);
      } else {
        notification().error("Failed to update step progress. Please try again.");
      }
    }, 1500);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Validation checks with specific error messages
    if (!formData.titleOfPaper.trim()) {
      notification().error("Please enter the title of the paper");
      return;
    }

    if (!formData.authorName.trim()) {
      notification().error("Please enter the author name");
      return;
    }

    if (!formData.journalName.trim()) {
      notification().error("Please enter the journal name");
      return;
    }

    if (!formData.pubYear) {
      notification().error("Please select the year of publication");
      return;
    }

    if (!formData.issNo.trim()) {
      notification().error("Please enter the ISSN number");
      return;
    }

    if (!formData.volume.trim()) {
      notification().error("Please enter the volume");
      return;
    }

    if (!formData.page.trim()) {
      notification().error("Please enter the page number");
      return;
    }

    if (!formData.listedIn) {
      notification().error("Please select where the paper is listed");
      return;
    }

    if (!formData.ugcListNo.trim()) {
      notification().error("Please enter the UGC list number");
      return;
    }

    // File validation for new entries
    if (!editingKey && !formData.uploadPaper) {
      notification().error("Please upload the research paper PDF file");
      return;
    }

    // File size validation
    if (formData.uploadPaper && typeof formData.uploadPaper === 'object') {
      const fileSizeMB = formData.uploadPaper.size / (1024 * 1024);
      if (fileSizeMB > 2) {
        notification().error("File size must be less than 2 MB");
        return;
      }

      // File type validation
      if (!formData.uploadPaper.type.includes('pdf')) {
        notification().error("Please upload only PDF files");
        return;
      }
    }

    try {
      if (editingKey) {
        // UPDATE existing research paper (PUT request with FormData for file upload)
        const formDataToSend = new FormData();

        // Append all fields for PUT request
        formDataToSend.append("id", editingKey);
        formDataToSend.append("supId", formData.supId);
        formDataToSend.append("titleOfPaper", formData.titleOfPaper.trim());
        formDataToSend.append("journalName", formData.journalName.trim());
        formDataToSend.append("authorName", formData.authorName.trim());
        formDataToSend.append("pubYear", formData.pubYear ? formData.pubYear.format('YYYY') : '');
        formDataToSend.append("issNo", formData.issNo.trim());
        formDataToSend.append("volume", formData.volume.trim());
        formDataToSend.append("page", formData.page.trim());
        formDataToSend.append("citations", formData.citations.trim());
        formDataToSend.append("impactFactor", formData.impactFactor.trim());
        formDataToSend.append("webUrl", formData.webUrl.trim());
        formDataToSend.append("listedIn", formData.listedIn);
        formDataToSend.append("ugcListNo", formData.ugcListNo.trim());

        // Handle file upload for PUT request
        if (formData.uploadPaper && typeof formData.uploadPaper === 'object') {
          // New file selected
          formDataToSend.append("uploadPaper", formData.uploadPaper);
          console.log("Updating with new file:", formData.uploadPaper.name);
        } else {
          // No new file selected, send empty value as per API requirement
          formDataToSend.append("uploadPaper", "");
          console.log("Updating without new file (keeping existing)");
        }

        console.log("=== PUT REQUEST FORMDATA ===");
        for (let [key, value] of formDataToSend.entries()) {
          if (value instanceof File) {
            console.log(`${key}: FILE - ${value.name} (${value.size} bytes)`);
          } else {
            console.log(`${key}: ${value}`);
          }
        }

        await API.put(`/SupervisorResearch/${editingKey}`, formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        notification().success("Research paper updated successfully!");
      } else {
        // CREATE new research paper (POST request with FormData for file upload)
        const formDataToSend = new FormData();

        // Append all fields
        formDataToSend.append("supId", formData.supId);
        formDataToSend.append("titleOfPaper", formData.titleOfPaper.trim());
        formDataToSend.append("authorName", formData.authorName.trim());
        formDataToSend.append("journalName", formData.journalName.trim());
        formDataToSend.append("pubYear", formData.pubYear ? formData.pubYear.format('YYYY') : '');
        formDataToSend.append("issNo", formData.issNo.trim());
        formDataToSend.append("volume", formData.volume.trim());
        formDataToSend.append("page", formData.page.trim());
        formDataToSend.append("citations", formData.citations.trim());
        formDataToSend.append("impactFactor", formData.impactFactor.trim());
        formDataToSend.append("webUrl", formData.webUrl.trim());
        formDataToSend.append("listedIn", formData.listedIn);
        formDataToSend.append("ugcListNo", formData.ugcListNo.trim());

        // Append file
        if (formData.uploadPaper) {
          formDataToSend.append("uploadPaper", formData.uploadPaper);
        }

        console.log("Creating new research paper");

        await API.post("/SupervisorResearch", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        notification().success("Research paper added successfully!");
      }

      // Only reset form and UI on successful save
      setFormData({
        supId,
        titleOfPaper: "",
        authorName: "",
        journalName: "",
        pubYear: null,
        issNo: "",
        volume: "",
        page: "",
        citations: "",
        impactFactor: "",
        webUrl: "",
        listedIn: "",
        ugcListNo: "",
        uploadPaper: "",
      });
      setEditingKey(null);
      setIsFormVisible(false);

      // Refresh the data immediately
      console.log("Calling handleGetAllResearchData after save");
      await handleGetAllResearchData();
      console.log("handleGetAllResearchData completed, researchData should be updated");

    } catch (err) {
      console.error("Error saving research paper:", err);

      // Provide specific error messages based on the error response
      if (err.response?.status === 400) {
        if (err.response.data?.message) {
          notification().error(`Validation Error: ${err.response.data.message}`);
        } else {
          notification().error("Please check all required fields and try again");
        }
      } else if (err.response?.status === 413) {
        notification().error("File size is too large. Please upload a file smaller than 2 MB");
      } else if (err.response?.status === 415) {
        notification().error("Invalid file type. Please upload only PDF files");
      } else if (err.response?.status === 500) {
        notification().error("Server error occurred. Please try again later");
      } else if (err.response?.data?.message) {
        notification().error(`Error: ${err.response.data.message}`);
      } else {
        notification().error(editingKey ? "Failed to update research paper. Please try again" : "Failed to save research paper. Please try again");
      }

      // Don't reset form data on error - keep user's input
      return;
    }
  };

  const handleEdit = (record) => {
    console.log("=== EDITING RESEARCH PAPER ===");
    console.log("Record to edit:", record);

    setFormData({
      supId,
      titleOfPaper: record.title || '',
      authorName: record.authorName || '',
      journalName: record.journalName || '',
      pubYear: record.pubYear ? dayjs(record.pubYear, 'YYYY') : null,
      issNo: record.issNo || '',
      volume: record.volume || '',
      page: record.page || '',
      citations: record.citations || '',
      impactFactor: record.impactFactor || '',
      webUrl: record.webUrl || '',
      listedIn: record.listedIn || '',
      ugcListNo: record.ugcListNo || '',
      uploadPaper: record.uploadPaper || '',
    });
    setEditingKey(record.key);
    setIsFormVisible(true);

    console.log("Edit mode activated for ID:", record.key);
  };


  const handleDelete = async (key) => {
    try {
      // Show confirmation dialog
      const confirmed = window.confirm("Are you sure you want to delete this research paper? This action cannot be undone.");

      if (!confirmed) {
        return;
      }

      // Call API to delete the research paper
      await API.delete(`/SupervisorResearch/${key}`);

      notification().success("Research paper deleted successfully!");

      // Refresh the data
      handleGetAllResearchData();

    } catch (error) {
      console.error("Error deleting research paper:", error);

      if (error.response?.status === 404) {
        notification().error("Research paper not found. It may have already been deleted.");
      } else if (error.response?.status === 403) {
        notification().error("You don't have permission to delete this research paper.");
      } else if (error.response?.data?.message) {
        notification().error(`Error: ${error.response.data.message}`);
      } else {
        notification().error("Failed to delete research paper. Please try again.");
      }
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      sorter: (a, b) => a.srNo - b.srNo,
    },
    {
      title: 'Title of Paper',
      dataIndex: 'title',
      key: 'title',
      width: 150,
      filteredValue: [searchText],
      onFilter: (value, record) => {
        const searchValue = value.toLowerCase();
        return String(record.title).toLowerCase().includes(searchValue) ||
          String(record.authorName).toLowerCase().includes(searchValue) ||
          String(record.journalName).toLowerCase().includes(searchValue) ||
          String(record.pubYear).toLowerCase().includes(searchValue);
      },
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => {
        const details = [
          { label: "Year of Publication", value: record.pubYear },
          { label: "Name of Journal", value: record.journalName },
          { label: "Author(s)", value: record.authorName },
          { label: "issNo No.", value: record.issNo },
          { label: "Volume", value: record.volume },
          { label: "Page No.", value: record.page },
          { label: "Citations", value: record.citations || "" },
          { label: "Impact Factor", value: record.impactFactor || "" },
          { label: "listed In", value: record.listedIn },
        ];

        return (
          <div className="text-sm">
            {details.map((item, index) => (
              <span key={index}>
                <span className="font-bold">{item.label}:</span> {item.value}
                {index < details.length - 1 && ", "}
              </span>
            ))}

            {record.webUrl && (
              <>
                ,{" "}
                <a
                  href={record.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1e40af] hover:underline"
                >
                  Web Link
                </a>
              </>
            )}

            {record.uploadPaper && (
              <>
                ,{" "}
                <span className="inline-flex items-center gap-2">
                  <button
                    onClick={() => openFile(`${baseFileURL}/${record.uploadPaper}`, `Research Paper - ${record.title}`)}
                    className="text-[#1e40af] hover:underline cursor-pointer text-xs bg-none border-none p-0"
                    title={`View ${record.uploadPaper.split('/').pop()}`}
                  >
                    Attachment
                  </button>

                </span>
              </>
            )}
          </div>
        );
      },
    },

    {
      title: 'Edit',
      key: 'edit',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <button 
          onClick={() => handleEdit(record)} 
          disabled={isReadOnly}
          className={`p-1 ${isReadOnly
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-[#1e40af] hover:text-[#1e3a8a]'
          }`}
          title={isReadOnly ? 'Cannot edit when step is read-only' : 'Edit'}
        >
          <Edit2 size={16} />
        </button>
      ),
    },
    // {
    //   title: 'Delete',
    //   key: 'delete',
    //   width: 70,
    //   align: 'center',
    //   render: (_, record) => (
    //     <button onClick={() => handleDelete(record.key)} className="text-red-600 hover:text-red-800 p-1">
    //       <Trash2 size={16} />
    //     </button>
    //   ),
    // },
  ];
  const handlePageChange = (e) => {
    const value = e.target.value;

    // Allow only numbers
    if (/^\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        page: value
      }));
    }
  };
  const handleYearChange = (date) => {
    // Prevent future years
    if (date && date.isAfter(dayjs(), 'year')) {
      notification().warning("Publication year cannot be in the future");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      pubYear: date
    }));
  };


  const inputClass = "w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm";
  const labelClass = "block text-sm font-medium text-[#374151] mb-1 font-inter";

  return (
    <div className="p-4 md:p-5">
      {/* Header with Add New Button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-[#111827] pb-2 border-b-2 border-[#1e40af] font-inter flex-1">
          Research Papers
        </h2>
        <button
          onClick={handleAddNew}
          disabled={isReadOnly}
          className={`flex items-center gap-2 py-2 px-4 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${isReadOnly
              ? 'bg-amber-200 text-amber-800 cursor-not-allowed border border-amber-300'
              : 'bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] hover:shadow-lg'
            }`}
          title={isReadOnly ? 'Step is read-only' : 'Add a new research paper'}
        >
          {isFormVisible && !editingKey ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          Add New Paper
        </button>
      </div>

      {/* Collapsible Form */}
      {isFormVisible && (
        <div className="mb-6 border border-[#d1d5db] rounded-lg p-4 bg-white shadow-sm">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Title of Paper<span className="text-red-600">*</span></label>
                <input type="text" name="titleOfPaper" value={formData.titleOfPaper} onChange={handleChange} className={inputClass} placeholder="Enter title" required />
              </div>

              <div>
                <label className={labelClass}>Name of Author<span className="text-red-600">*</span></label>
                <input type="text" name="authorName" value={formData.authorName} onChange={handleChange} className={inputClass} placeholder="Enter author name" required />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Name of Journal<span className="text-red-600">*</span></label>
                <input type="text" name="journalName" value={formData.journalName} onChange={handleChange} className={inputClass} placeholder="Enter journal name" required />
              </div>

              <div>
                <label className={labelClass}>Year of Publication<span className="text-red-600">*</span></label>
                <DatePicker
                  picker="year"
                  name="pubYear"
                  value={formData.pubYear}
                  onChange={handleYearChange}
                  className={inputClass}
                  style={{ width: '100%' }}
                  placeholder="Select year"
                  maxDate={dayjs()}
                  disabledDate={(current) => current && current.isAfter(dayjs(), 'year')}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Publication year cannot be in the future</p>
              </div>

              <div>
                <label className={labelClass}>iss No.<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="issNo"
                  value={formData.issNo}
                  onChange={handleISSNChange}
                  className={inputClass}
                  placeholder="Enter ISSN (will be converted to uppercase)"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Volume<span className="text-red-600">*</span></label>
                <input type="text" name="volume" value={formData.volume} onChange={handleChange} className={inputClass} placeholder="Enter volume" required />
              </div>

              <div>
                <label className={labelClass}>Enter number of pages<span className="text-red-600">*</span></label>
                <input
                  type="text"
                  name="page"
                  value={formData.page}
                  onChange={handlePageChange}
                  className={inputClass}
                  placeholder="Enter page"
                  required
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className={labelClass}>Citations</label>
                <input
                  type="text"
                  name="citations"
                  value={formData.citations}
                  onChange={handleDecimalChange}
                  className={inputClass}
                  placeholder="Enter citations"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className={labelClass}>Impact Factor</label>
                <input
                  type="text"
                  name="impactFactor"
                  value={formData.impactFactor}
                  onChange={handleDecimalChange}
                  className={inputClass}
                  placeholder="Enter impact factor"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className={labelClass}>Web Link<span className="text-red-600">*</span></label>
                <input type="url" name="webUrl" value={formData.webUrl} onChange={handleChange} className={inputClass} placeholder="Enter web link" />
              </div>

              <div>
                <label className={labelClass}>listed In<span className="text-red-600">*</span></label>
                <select name="listedIn" value={formData.listedIn} onChange={handleChange} className={inputClass} required>
                  <option value="">--Select--</option>
                  <option value="UGC-listedIn">UGC-listedIn</option>
                  <option value="UGC-Care">UGC-Care</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>UGC List No.<span className="text-red-600">*</span></label>
                <input type="text" name="ugcListNo" value={formData.ugcListNo} onChange={handleChange} className={inputClass} placeholder="NA" required />
              </div>

              <div>
                <label className={labelClass}>
                  Upload Paper (.pdf upto 2 MB){!editingKey && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="file"
                  name="uploadPaper"
                  onChange={(e) => setFormData({ ...formData, uploadPaper: e.target.files[0] })}
                  className={inputClass}
                  required={!editingKey} // Only required for new entries, not for editing
                />
                {formData.uploadPaper && typeof formData.uploadPaper === 'object' && (
                  <p className="mt-1 text-sm text-gray-500">Selected file: {formData.uploadPaper.name}</p>
                )}
                {editingKey && formData.uploadPaper && typeof formData.uploadPaper === 'string' && (
                  <p className="mt-1 text-sm text-blue-600">Current file: {formData.uploadPaper.split('/').pop()}</p>
                )}
                {editingKey && (
                  <p className="mt-1 text-xs text-gray-500">Leave empty to keep existing file, or select new file to replace</p>
                )}
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#e5e7eb]">
              {editingKey && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFormVisible(false);
                    setEditingKey(null);
                    setFormData({
                      titleOfPaper: '',
                      authorName: '',
                      journalName: '',
                      pubYear: null,
                      issNo: '',
                      volume: '',
                      page: '',
                      citations: '',
                      impactFactor: '',
                      webUrl: '',
                      listedIn: '',
                      ugcListNo: '',
                      uploadPaper: '',
                    });
                  }}
                  className="bg-gray-500 text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:bg-gray-600 active:scale-[0.98] shadow-md hover:shadow-lg"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] shadow-md hover:shadow-lg">
                {editingKey ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Research Papers Table */}
      <div className="mb-6">

        {/* Search Input */}
        <div className="mb-3">
          <Input
            placeholder="Search by title or details..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-md"
            allowClear
          />
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={researchData}
          pagination={{ pageSize: 5 }}
          bordered
          size="small"
          className="shadow-sm"
        />

        {/* Research Papers Status Display */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Research Papers: </span>
              <span className="text-sm font-semibold text-blue-700">
                {researchData.length} paper{researchData.length !== 1 ? 's' : ''} added
              </span>
              <span className="text-xs text-gray-600 ml-2">
                (Required: {totalResearchPaper} papers)
              </span>
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${researchData.length >= totalResearchPaper
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
              }`}>
              {researchData.length >= totalResearchPaper
                ? '✓ Meets Requirement'
                : `✗ Need ${totalResearchPaper - researchData.length} more`}
            </div>
          </div>
        </div>
      </div>

      {/* Save & Next Button */}
      <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
        <button
          type="button"
          onClick={handleSaveAndNext}
          disabled={isReadOnly || (totalResearchPaper > 0 && researchData.length < totalResearchPaper)}
          className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${isReadOnly || (totalResearchPaper > 0 && researchData.length < totalResearchPaper)
              ? 'bg-amber-200 text-amber-800 cursor-not-allowed border border-amber-300'
              : 'bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] hover:shadow-lg'
            }`}
          title={isReadOnly 
            ? 'Step is read-only'
            : (totalResearchPaper > 0 && researchData.length < totalResearchPaper)
            ? `${totalResearchPaper} research papers required. Current: ${researchData.length}`
            : 'Proceed to next step'}
        >
          Save & Next
          <ChevronRight size={18} />
        </button>
      </div>

      {/* File Viewer Modal */}
      {FileViewerModal}
    </div>
  );
};

export default ResearchPapers;