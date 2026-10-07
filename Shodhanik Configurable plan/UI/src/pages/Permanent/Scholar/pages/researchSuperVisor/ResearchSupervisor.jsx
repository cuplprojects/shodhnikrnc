import { useState, useEffect } from 'react';
import { Modal, Button } from 'antd';
import { EyeOutlined, ExportOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { formatDate as formatDateUtil } from '@/utils/dateUtils';

const ResearchSupervisor = () => {
  const [supervisors, setSupervisors] = useState([]);
  const [coSupervisors, setCoSupervisors] = useState([]);
  const [allCoSupervisors, setAllCoSupervisors] = useState([]); // Store all co-supervisors
  const [existingData, setExistingData] = useState(null);
  const [supervisorDetails, setSupervisorDetails] = useState(null);
  const [coSupervisorDetails, setCoSupervisorDetails] = useState(null);
  const [secondSupervisorDetails, setSecondSupervisorDetails] = useState(null);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);


  const [formData, setFormData] = useState({
    supiD1: '',
    suP1ConsentFilePath: null,
    cosupid: '',
    cosupConsentFilePath: null
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSecondSupervisorForm, setShowSecondSupervisorForm] = useState(false);
  const [secondFormData, setSecondFormData] = useState({
    supiD2: '',
    suP2ConsentFilePath: null,
    nocFilePath: null
  });

  const { getSId } = useSelectedScholarAuthStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const sId = getSId();

        if (!sId) {
          notification().error('Scholar ID not found');
          return;
        }

        // Always fetch supervisor lists
        const [supervisorResponse, coSupervisorResponse] = await Promise.all([
          API.get(`/ScholarSupervisor/SupervisorforScholarSelect/${sId}/internal`),
          API.get(`/ScholarSupervisor/SupervisorforScholarSelect/${sId}/external`)
        ]);

        setSupervisors(supervisorResponse.data);
        setAllCoSupervisors(coSupervisorResponse.data);
        setCoSupervisors(coSupervisorResponse.data);

        // First check if existing data exists
        try {
          const existingResponse = await API.get(`/ScholarSupervisor/BySid/${sId}`);
          if (existingResponse.data) {
            setExistingData(existingResponse.data);
            setHasExistingData(true);

            // Fetch supervisor details if they exist
            const supervisorPromises = [];

            if (existingResponse.data.supiD1) {
              supervisorPromises.push(
                API.get(`/SupervisorRegistration/${existingResponse.data.supiD1}`)
                  .then(res => setSupervisorDetails(res.data))
                  .catch(err => console.error('Error fetching supervisor 1 details:', err))
              );
            }

            if (existingResponse.data.supiD2) {
              supervisorPromises.push(
                API.get(`/SupervisorRegistration/${existingResponse.data.supiD2}`)
                  .then(res => setSecondSupervisorDetails(res.data))
                  .catch(err => console.error('Error fetching supervisor 2 details:', err))
              );
            }

            if (existingResponse.data.cosupid) {
              supervisorPromises.push(
                API.get(`/SupervisorRegistration/${existingResponse.data.cosupid}`)
                  .then(res => setCoSupervisorDetails(res.data))
                  .catch(err => console.error('Error fetching co-supervisor details:', err))
              );
            }

            // Wait for all supervisor details to be fetched
            await Promise.all(supervisorPromises);
            return;
          }
        } catch (err) {
          // If 404 or no data, continue to show form
          console.log('No existing data found, showing form');
        }

        setHasExistingData(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        // notification().error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getSId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // If supervisor is changed, filter co-supervisors to exclude selected supervisor
    if (field === 'supiD1') {
      if (value) {
        // Filter out the selected supervisor from co-supervisors list
        const filteredCoSupervisors = allCoSupervisors.filter(
          coSup => coSup.supId.toString() !== value.toString()
        );
        setCoSupervisors(filteredCoSupervisors);

        // Reset co-supervisor selection if it was the same as supervisor
        if (formData.cosupid === value) {
          setFormData(prev => ({
            ...prev,
            cosupid: ''
          }));
        }
      } else {
        // If no supervisor selected, show all co-supervisors
        setCoSupervisors(allCoSupervisors);
      }
    }
  };

  const handleFileChange = (field, file) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleViewFile = (filePath, fileName) => {
    setSelectedFile({ filePath, fileName });
    setViewModalVisible(true);
  };

  const handleOpenInNewTab = () => {
    if (selectedFile?.filePath) {
      const fileUrl = `${getBaseFileURL()}/${selectedFile.filePath}`;
      window.open(fileUrl, '_blank');
    }
  };

  const handleViewModalCancel = () => {
    setViewModalVisible(false);
    setSelectedFile(null);
  };

  const handleSecondFormChange = (field, value) => {
    setSecondFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSecondFormFileChange = (field, file) => {
    setSecondFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleSubmitSecondSupervisor = async (e) => {
    e.preventDefault();

    if (!secondFormData.supiD2 || !secondFormData.suP2ConsentFilePath) {
      notification().error('Supervisor ID and consent letter are required');
      return;
    }

    try {
      setSubmitting(true);
      const sId = getSId();
      const formDataToSend = new FormData();

      formDataToSend.append('decision', 0);
      formDataToSend.append('supiD2', secondFormData.supiD2);
      formDataToSend.append('suP2ConsentFile', secondFormData.suP2ConsentFilePath);
      if (secondFormData.nocFilePath) {
        formDataToSend.append('nocFile', secondFormData.nocFilePath);
      }
      formDataToSend.append('secondRequestAt', new Date().toISOString());

      await API.patch(`/ScholarSupervisor/UpdateScholarSupervisor/${sId}`, formDataToSend);

      notification().success('Second supervisor request submitted successfully!');

      // Refresh the data
      const existingResponse = await API.get(`/ScholarSupervisor/BySid/${sId}`);
      if (existingResponse.data) {
        setExistingData(existingResponse.data);
        setShowSecondSupervisorForm(false);
        setSecondFormData({
          supiD2: '',
          suP2ConsentFilePath: null,
          nocFilePath: null
        });

        // Fetch second supervisor details if available
        if (existingResponse.data.supiD2) {
          try {
            const res = await API.get(`/SupervisorRegistration/${existingResponse.data.supiD2}`);
            setSecondSupervisorDetails(res.data);
          } catch (err) {
            console.error('Error fetching supervisor 2 details:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error submitting second supervisor:', err);
      notification().error('Failed to submit second supervisor request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return formatDateUtil(dateString);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.supiD1 || !formData.suP1ConsentFilePath) {
      notification().error('Supervisor and consent letter are required');
      return;
    }

    try {
      setSubmitting(true);

      const sId = getSId();
      const formDataToSend = new FormData();

      formDataToSend.append('sid', sId);
      formDataToSend.append('supiD1', formData.supiD1);
      formDataToSend.append('suP1ConsentFile', formData.suP1ConsentFilePath);
      if (formData.cosupid) {
        formDataToSend.append('cosupid', formData.cosupid);
      }
      if (formData.cosupConsentFilePath) {
        formDataToSend.append('cosupConsentFile', formData.cosupConsentFilePath);
      }
      formDataToSend.append('requestedAt', new Date().toISOString());
      // formDataToSend.append('approvedAt', new Date().toISOString());

      // POST the data with multipart form data headers
      await API.post('/ScholarSupervisor', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      notification().success('Supervisor selection submitted successfully!');

      // Fetch the newly created data
      const existingResponse = await API.get(`/ScholarSupervisor/BySid/${sId}`);
      if (existingResponse.data) {
        setExistingData(existingResponse.data);
        setHasExistingData(true);

        // Fetch supervisor details
        const supervisorPromises = [];

        if (existingResponse.data.supiD1) {
          supervisorPromises.push(
            API.get(`/SupervisorRegistration/${existingResponse.data.supiD1}`)
              .then(res => setSupervisorDetails(res.data))
              .catch(err => console.error('Error fetching supervisor 1 details:', err))
          );
        }

        if (existingResponse.data.supiD2) {
          supervisorPromises.push(
            API.get(`/SupervisorRegistration/${existingResponse.data.supiD2}`)
              .then(res => setSecondSupervisorDetails(res.data))
              .catch(err => console.error('Error fetching supervisor 2 details:', err))
          );
        }

        if (existingResponse.data.cosupid) {
          supervisorPromises.push(
            API.get(`/SupervisorRegistration/${existingResponse.data.cosupid}`)
              .then(res => setCoSupervisorDetails(res.data))
              .catch(err => console.error('Error fetching co-supervisor details:', err))
          );
        }

        // Wait for all supervisor details to be fetched
        await Promise.all(supervisorPromises);
      }

    } catch (err) {
      console.error('Error submitting form:', err);
      notification().error('Failed to submit supervisor selection');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  // If existing data exists, show view mode
  if (hasExistingData && existingData) {
    return (
      <div className="p-4 bg-gray-50">
        {/* Header */}
        <div className="bg-slate-700 text-white rounded-lg p-4 mb-6">
          <h1 className="text-xl font-semibold">Research Supervisor Selection</h1>
          <p className="text-slate-200 text-sm mt-1">Your supervisor selection details</p>
        </div>

        {/* Existing Data View */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="bg-slate-100 p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Supervisor Selection Details</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Research Supervisor Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Research Supervisor</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Name</span>
                    <span className="col-span-2 text-slate-900">{supervisorDetails?.fullName || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Mobile Number</span>
                    <span className="col-span-2 text-slate-900">{supervisorDetails?.mobileNo || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Email</span>
                    <span className="col-span-2 text-slate-900">{supervisorDetails?.email || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Consent Letter</span>
                    <span className="col-span-2">
                      {existingData.suP1ConsentFilePath ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 text-sm">Document uploaded</span>
                          <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewFile(existingData.suP1ConsentFilePath, 'Supervisor Consent Letter')}
                            size="small"
                            className="text-blue-600 hover:text-blue-800 p-0"
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-500">No document uploaded</span>
                      )}
                    </span>
                  </div>

                  {existingData.supiD2 && (
                    <>
                      <div className="border-t border-slate-300 pt-3 mt-3">
                        <h4 className="font-medium text-slate-700 mb-2 text-sm">Second Supervisor</h4>
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-slate-600 font-medium">Name</span>
                            <span className="col-span-2 text-slate-900">{secondSupervisorDetails?.fullName || '-'}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-slate-600 font-medium">Mobile Number</span>
                            <span className="col-span-2 text-slate-900">{secondSupervisorDetails?.mobileNo || '-'}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-slate-600 font-medium">Email</span>
                            <span className="col-span-2 text-slate-900">{secondSupervisorDetails?.email || '-'}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-slate-600 font-medium">Supervisor ID</span>
                            <span className="col-span-2 text-slate-900">{existingData.supiD2}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="text-slate-600 font-medium">Consent Letter</span>
                            <span className="col-span-2">
                              {existingData.suP2ConsentFilePath ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-900 text-sm">Document uploaded</span>
                                  <Button
                                    type="link"
                                    icon={<EyeOutlined />}
                                    onClick={() => handleViewFile(existingData.suP2ConsentFilePath, 'Second Supervisor Consent Letter')}
                                    size="small"
                                    className="text-blue-600 hover:text-blue-800 p-0"
                                  >
                                    View
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-slate-500">No document uploaded</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Co-Supervisor Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Co-Supervisor</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Name</span>
                    <span className="col-span-2 text-slate-900">{coSupervisorDetails?.fullName || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Mobile Number</span>
                    <span className="col-span-2 text-slate-900">{coSupervisorDetails?.mobileNo || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Email</span>
                    <span className="col-span-2 text-slate-900">{coSupervisorDetails?.email || '-'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Co-Supervisor Consent</span>
                    <span className="col-span-2">
                      {existingData.cosupConsentFilePath ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 text-sm">Document uploaded</span>
                          <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewFile(existingData.cosupConsentFilePath, 'Co-Supervisor Consent Letter')}
                            size="small"
                            className="text-blue-600 hover:text-blue-800 p-0"
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-500">No document uploaded</span>
                      )}
                    </span>
                  </div>
                  {/* <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">NOC File</span>
                    <span className="col-span-2">
                      {existingData.nocFilePath ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 text-sm">Document uploaded</span>
                          <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewFile(existingData.nocFilePath, 'NOC Document')}
                            size="small"
                            className="text-blue-600 hover:text-blue-800 p-0"
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-500">No document uploaded</span>
                      )}
                    </span>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Timeline Information */}
            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Requested At</label>
                  <p className="text-slate-900 text-sm">{formatDate(existingData.requestedAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Approved At</label>
                  <p className="text-slate-900 text-sm">{formatDate(existingData.approvedAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Second Request At</label>
                  <p className="text-slate-900 text-sm">{formatDate(existingData.secondRequestAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Second Approved At</label>
                  <p className="text-slate-900 text-sm">{formatDate(existingData.secondApprovedAt)}</p>
                </div>
              </div>
            </div>

            {/* Second Supervisor Change Request Section */}
            {existingData.secondRequestAt && (
              <div className="mt-6 bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-800">Research Supervisor Change Request</h3>
                </div>
                <div className="p-6">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-slate-600 font-medium">Proposed Supervisor</span>
                        <span className="col-span-2 text-slate-900">{secondSupervisorDetails ? `${secondSupervisorDetails.title} ${secondSupervisorDetails.fullName}` : '-'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-slate-600 font-medium">Mobile Number</span>
                        <span className="col-span-2 text-slate-900">{secondSupervisorDetails?.mobileNo || '-'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-slate-600 font-medium">Email</span>
                        <span className="col-span-2 text-slate-900">{secondSupervisorDetails?.email || '-'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-slate-600 font-medium">Consent Letter</span>
                        <span className="col-span-2">
                          {existingData.suP2ConsentFilePath ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900 text-sm">Document uploaded</span>
                              <Button
                                type="link"
                                icon={<EyeOutlined />}
                                onClick={() => handleViewFile(existingData.suP2ConsentFilePath, 'Second Supervisor Consent Letter')}
                                size="small"
                                className="text-blue-600 hover:text-blue-800 p-0"
                              >
                                View
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-500">No document uploaded</span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-slate-600 font-medium">NOC</span>
                        <span className="col-span-2">
                          {existingData.nocFilePath ? (
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600 text-sm cursor-pointer hover:underline">View NOC of Old Supervisor</span>
                              <Button
                                type="link"
                                icon={<EyeOutlined />}
                                onClick={() => handleViewFile(existingData.nocFilePath, 'NOC Document')}
                                size="small"
                                className="text-blue-600 hover:text-blue-800 p-0"
                              >
                                View
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-500">No document uploaded</span>
                          )}
                        </span>
                      </div>
                      <div className="border-t border-slate-300 pt-3 mt-3">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <span className="text-slate-600 font-medium">Requested at</span>
                          <span className="col-span-2 text-slate-900">{formatDate(existingData.secondRequestAt)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                          <span className="text-slate-600 font-medium">Status</span>
                          <span className="col-span-2">
                            <span className={`text-sm font-medium ${existingData.secondApprovedAt ? 'text-green-600' : 'text-yellow-600'}`}>
                              {existingData.secondApprovedAt ? 'Approved' : 'Pending'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Message */}
                  {!existingData.secondApprovedAt && (
                    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-700">
                        Research Supervisor Consent is under verification
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Information */}
            {(existingData.decision1 === 1 || existingData.approvedAt) ? (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-1">Status Information</h4>
                <p className="text-sm text-green-700">
                  Your supervisor selection has been approved.
                </p>
                {existingData.decision1Remark && (
                  <p className="text-sm text-green-800 mt-2">
                    <span className="font-medium">Remark:</span> {existingData.decision1Remark}
                  </p>
                )}
              </div>
            ) : existingData.decision1 === 2 ? (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-1">Status Information</h4>
                <p className="text-sm text-red-700">
                  Your supervisor selection has been rejected.
                </p>
                {existingData.decision1Remark && (
                  <p className="text-sm text-red-800 mt-2">
                    <span className="font-medium">Remark:</span> {existingData.decision1Remark}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-1">Status Information</h4>
                <p className="text-sm text-blue-700">
                  Your supervisor selection has been submitted and is currently under review. 
                  You will be notified once the approval process is complete.
                </p>
              </div>
            )}

            {/* Second Supervisor Request Button */}
            {existingData.approvedAt && !existingData.secondRequestAt && (
              <div className="mt-6">
                <button
                  onClick={() => setShowSecondSupervisorForm(!showSecondSupervisorForm)}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {showSecondSupervisorForm ? 'Cancel' : 'Request Second Supervisor'}
                </button>
              </div>
            )}

            {/* Second Supervisor Form */}
            {showSecondSupervisorForm && existingData.approvedAt && !existingData.secondRequestAt && (
              <div className="mt-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Request Second Supervisor</h3>
                <form onSubmit={handleSubmitSecondSupervisor} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Second Supervisor *
                    </label>
                    <select
                      value={secondFormData.supiD2}
                      onChange={(e) => handleSecondFormChange('supiD2', e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                      required
                    >
                      <option value="">Choose a supervisor...</option>
                      {supervisors
                        .filter(supervisor => supervisor.supId.toString() !== existingData.supiD1.toString())
                        .map((supervisor) => (
                          <option key={supervisor.supId} value={supervisor.supId}>
                            {supervisor.fullName}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Second Supervisor Consent Letter *
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleSecondFormFileChange('suP2ConsentFilePath', e.target.files[0])}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                      accept=".pdf,.doc,.docx"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Accepted formats: PDF, DOC, DOCX
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      NOC File (Reqruied for previous spervisor)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleSecondFormFileChange('nocFilePath', e.target.files[0])}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                      accept=".pdf,.doc,.docx"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Accepted formats: PDF, DOC, DOCX
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        'Submit Second Supervisor'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSecondSupervisorForm(false)}
                      className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* View Modal */}
        <Modal
          title={
            <div className="flex justify-between items-center">
              <span>View Document - {selectedFile?.fileName}</span>
              <Button
                type="link"
                icon={<ExportOutlined />}
                onClick={handleOpenInNewTab}
                className="text-blue-600 hover:text-blue-800"
              >
                Open in New Tab
              </Button>
            </div>
          }
          open={viewModalVisible}
          onCancel={handleViewModalCancel}
          footer={null}
          width={900}
          style={{ top: 20 }}
        >
          {selectedFile?.filePath && (
            <div className="mt-4">
              <iframe
                src={`${getBaseFileURL()}/${selectedFile.filePath}`}
                width="100%"
                height="600px"
                style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}
                title={selectedFile.fileName}
              >
                <p>Your browser does not support iframes. Please <a href={`${getBaseFileURL()}/${selectedFile.filePath}`} target="_blank" rel="noopener noreferrer">click here to view the document</a>.</p>
              </iframe>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="p-2 bg-gray-50">
      {/* Header */}
      <div className="bg-slate-700 text-white rounded-md p-3 mb-3">
        <h1 className="text-base font-semibold">Research Supervisor Selection</h1>
        <p className="text-slate-200 text-xs mt-0.5">
          Select your research supervisor and co-supervisor
        </p>
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200">
        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
          <h2 className="font-semibold text-sm text-slate-800">
            Supervisor Selection Form
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Research Supervisor */}
            <div>
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                <h3 className="font-semibold text-sm text-slate-800 mb-2">
                  Research Supervisor
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Select Supervisor *
                    </label>
                    <select
                      value={formData.supiD1}
                      onChange={(e) =>
                        handleInputChange('supiD1', e.target.value)
                      }
                      className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                      required
                    >
                      <option value="">Choose...</option>
                      {supervisors.map((supervisor) => (
                        <option
                          key={supervisor.supId}
                          value={supervisor.supId}
                        >
                          {supervisor.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Consent Letter *
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        handleFileChange(
                          'suP1ConsentFilePath',
                          e.target.files[0]
                        )
                      }
                      className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-500 focus:border-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                      accept=".pdf,.doc,.docx"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      PDF / DOC / DOCX
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Co-Supervisor */}
            <div>
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                <h3 className="font-semibold text-sm text-slate-800 mb-2">
                  Co-Supervisor
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Co-Supervisor (Optional)
                    </label>
                    <select
                      value={formData.cosupid}
                      onChange={(e) => handleInputChange('cosupid', e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                    >
                      <option value="">Choose...</option>
                      {coSupervisors.map((coSupervisor) => (
                        <option
                          key={coSupervisor.supId}
                          value={coSupervisor.supId}
                        >
                          {coSupervisor.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Co-Supervisor Consent Letter (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        handleFileChange(
                          'cosupConsentFilePath',
                          e.target.files[0]
                        )
                      }
                      className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-500 focus:border-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                      accept=".pdf,.doc,.docx"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      PDF / DOC / DOCX
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-4 flex justify-center">
            <button
              type="submit"
              disabled={submitting}
              className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 text-sm rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">Important Instructions</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Supervisor and consent letter are mandatory</li>
              <li>• Co-supervisor and its consent letter are optional</li>
              <li>• All submitted consent letters must be properly signed</li>
              <li>• Only PDF, DOC, and DOCX formats are accepted for consent letters</li>
              <li>• Once submitted, the selection will be sent for approval</li>
            </ul>
          </div>
        </form>
      </div>
    </div>

  );
};

export default ResearchSupervisor;