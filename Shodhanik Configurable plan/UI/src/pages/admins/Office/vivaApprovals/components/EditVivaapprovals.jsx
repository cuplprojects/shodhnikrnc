import { useState, useEffect } from 'react';
import { Button, Space, message, Input, Select, Upload, Modal } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, EyeOutlined, DownloadOutlined, ExportOutlined } from '@ant-design/icons';
import API from '@/services/API'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader'
import notification from '@/services/NotificationService'
import {hasPermission} from '@/services/hasPermissionService';


const { TextArea } = Input;
const { Option } = Select;

const EditVivaapprovals = ({ selectedRecord, onBack }) => {
  const [candidateData, setCandidateData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vivaReportFile, setVivaReportFile] = useState(null);
  const [examinerRemarks, setExaminerRemarks] = useState('');
  const [uploadDecision, setUploadDecision] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [awardData, setAwardData] = useState(null);

  // PDF Preview Modal states
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfTitle, setCurrentPdfTitle] = useState('');

  const notify = notification();
  const canread = hasPermission('viva_approval.read')
  const canupdate = hasPermission('viva_approval.update')
  const candownload= hasPermission('viva_approval.download')
  const canupload = hasPermission('viva_approval.upload')

  // Get candidate ID from selectedRecord 
  const candidateId = selectedRecord?.sid || 1; // Default to 1 for demo

  const handlePreviewPdf = (filePath, title) => {
    if (!filePath) {
      notify.error('No file available for preview');
      return;
    }
    const fullUrl = `${getBaseFileURL()}/${filePath}`;
    setCurrentPdfUrl(fullUrl);
    setCurrentPdfTitle(title);
    setPdfModalVisible(true);
  };

  const handleOpenInNewTab = () => {
    if (currentPdfUrl) {
      window.open(currentPdfUrl, '_blank');
    }
  };

  // Fetch award examinee data
  const fetchAwardExamineeData = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/AwardExaminee/${candidateId}`);
      setCandidateData(response.data);
      
      // Check if award data already exists
      if (response.data && response.data.length > 0) {
        const data = response.data[0];
        if (data.uploadRemark && data.awardFilePath) {
          setAwardData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching award examinee data:', error);
      notify.error('Failed to fetch candidate details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRecord) {
      fetchAwardExamineeData();
    }
  }, [candidateId, selectedRecord]);

  // Handle viva status update
  const handleVivaStatusUpdate = async () => {
    // Validation
    if (!uploadDecision) {
      notify.error('Please select upload decision (Awarded/Not Awarded)');
      return;
    }
    if (uploadDecision === '2' && !examinerRemarks.trim()) {
      notify.error('Remarks are mandatory for "Not Awarded" decision');
      return;
    }
    if (!vivaReportFile) {
      notify.error('Please upload viva report file');
      return;
    }

    setUploadLoading(true);
    
    try {
      // Create FormData for multipart upload with correct field names
      const formData = new FormData();
      formData.append('SId', candidateId); // Note: Capital 'S' as per API spec
      formData.append('UploadRemark', examinerRemarks); // API expects 'UploadRemark'
      formData.append('AwardFile', vivaReportFile); // API expects 'AwardFile'
      formData.append('UploadDecision', uploadDecision); // Add upload decision (1 or 2)

      // Log FormData contents for debugging
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const response = await API.post('/AwardExaminee', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload response:', response.data);

      if (response.data) {
        notify.success(response.data.message || 'AwardExaminee created successfully');
        
        // Log the file path for reference
        if (response.data.awardFilePath) {
          console.log('Award file saved at:', response.data.awardFilePath);
        }
        
        // Reset form
        setUploadDecision('');
        setVivaReportFile(null);
        setExaminerRemarks('');
        
        // Refresh candidate data
        fetchAwardExamineeData();
      }
    } catch (error) {
      console.error('Error updating viva status:', error);
      
      if (error.response?.data?.message) {
        notify.error(error.response.data.message);
      } else if (error.response?.status === 400) {
        notify.error('Invalid data provided. Please check all fields.');
      } else if (error.response?.status === 500) {
        notify.error('Server error occurred. Please try again later.');
      } else {
        notify.error('Failed to update viva status. Please try again.');
      }
    } finally {
      setUploadLoading(false);
    }
  };


  if (!selectedRecord || !candidateData.length) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        {loading ? 'Loading...' : 'No candidate selected or data available'}
      </div>
    );
  }

  const candidate = candidateData[0]; // Get first record for basic details

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    border: '2px solid #000',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif'
  };

  const cellStyle = {
    border: '1px solid #000',
    padding: '8px',
    textAlign: 'left',
    verticalAlign: 'top'
  };

  const headerCellStyle = {
    ...cellStyle,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold'
  };

  const rightAlignStyle = {
    ...cellStyle,
    textAlign: 'right',
    fontWeight: 'bold'
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header Buttons */}
      <Space style={{ marginBottom: '16px' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={onBack}
        >
          Back to List
        </Button>
        {/* <Button icon={<PrinterOutlined />}>
          Print
        </Button> */}
      </Space>

      {/* Print Header */}

      {/* Main Table Container */}
      <div style={{ backgroundColor: 'white', padding: '20px', border: '2px solid #000' }}>
      <div className="flex justify-center">
      <PrintHeader />
      </div>
        
        {/* Basic Details Table */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="2">Basic Details</td>
              <td style={{...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap', paddingRight: '12px', width: '200px'}}><strong>Shodhanik ID:</strong> {candidate.permUserName}</td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Admission Session :</strong></td>
              <td style={cellStyle}>{candidate.year}</td>
              <td style={cellStyle} rowSpan="7" width="150px">
                <div style={{ 
                  width: '120px', 
                  height: '150px', 
                  border: '1px solid #000', 
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fafafa',
                  overflow: 'hidden'
                }}>
                  {candidate.profileImage ? (
                    <img 
                      src={`${getBaseFileURL()}/${candidate.profileImage}`} 
                      alt="Candidate Photo"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '24px' }}>No Image Found</span>
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Department/Subject :</strong></td>
              <td style={cellStyle}>{candidate.subjectName}</td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Scholar Name :</strong></td>
              <td style={cellStyle}>{candidate.name}</td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Mobile No. :</strong></td>
              <td style={cellStyle}>{candidate.contactNo} &nbsp;&nbsp; </td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Email Id :</strong></td>
              <td style={cellStyle}>{candidate.email}</td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Correspondence Address :</strong></td>
              <td style={cellStyle}>{candidate.correspondenceAddress}</td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Permanent Address :</strong></td>
              <td style={cellStyle}>{candidate.permanentAddress}</td>
            </tr>
          </tbody>
        </table>

        <br />

        {/* Examiner Details Table */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="3">Examiner Details</td>
            </tr>
            <tr>
              <td style={headerCellStyle} width="80px">Sr. No.</td>
              <td style={headerCellStyle} width="200px">Name of Examiner</td>
              <td style={headerCellStyle}>Detail</td>
            </tr>
            {candidateData.map((examiner, index) => (
              <tr key={index}>
                <td style={cellStyle}>{index + 1}</td>
                <td style={cellStyle}>{examiner.examinerName}</td>
                <td style={cellStyle}>
                  <div><strong>Designation :</strong> {examiner.designationName}</div>
                  <div><strong>University / Institution :</strong> {examiner.institution}</div>
                  <div><strong>Address :</strong> {examiner.address}</div>
                  <div><strong>Email :</strong> {examiner.examinerEmail} &nbsp;&nbsp; <strong>Phone :</strong> {examiner.contactNo} &nbsp;&nbsp; <strong>External Examiner</strong></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <br />

        {/* Upload Viva Report Section */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="2">Upload Viva Report</td>
            </tr>
            
            {awardData ? (
              // Show already uploaded data
              <>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px', backgroundColor: '#f0f8ff' }} colSpan="2">
                    <div style={{ color: 'green', fontWeight: 'bold', marginBottom: '8px' }}>
                      ✓ Viva Report Already Uploaded
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px', width: '150px' }}><strong>Upload Decision</strong></td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: awardData.uploadDecision === 1 ? 'green' : 'red' }}>
                      {awardData.uploadDecision === 1 ? 'Awarded' : 'Not Awarded'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px' }}><strong>Attachment</strong></td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* <a 
                        href={`${getBaseFileURL()}/${awardData.awardFilePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'blue', textDecoration: 'underline' }}
                      >
                        📄 {awardData.awardFilePath.split('/').pop()}
                      </a> */}
                      {canread && (
                        <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() => handlePreviewPdf(
                          awardData.awardFilePath,
                          'Viva Report Document'
                        )}
                      >
                        Preview
                      </Button>
                      )}
                      
                      {candownload && (
                         <Button
                        type="default"
                        icon={<DownloadOutlined />}
                        size="small"
                        onClick={() => window.open(`${getBaseFileURL()}/${awardData.awardFilePath}`, '_blank')}
                      >
                        Download
                      </Button>
                      )}
                     
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px' }}><strong>Remarks</strong></td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <div style={{ 
                      padding: '6px', 
                      backgroundColor: '#f5f5f5', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '3px',
                      fontSize: '12px'
                    }}>
                      {awardData.uploadRemark}
                    </div>
                  </td>
                </tr>
              </>
            ) : (
              // Show upload form
              <>
                <tr>
                  <td style={{ ...cellStyle, width: '150px', padding: '6px' }}><strong>Upload Decision</strong></td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="--Select--"
                      value={uploadDecision}
                      onChange={setUploadDecision}
                      size="small"
                    >
                      <Option value="1">Awarded</Option>
                      <Option value="2">Not Awarded</Option>
                    </Select>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px' }}><strong>Attachment</strong></td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    {canupload && (
                       <Upload
                      beforeUpload={() => false}
                      onChange={(info) => {
                        if (info.file.status !== 'removed') {
                          setVivaReportFile(info.file);
                        } else {
                          setVivaReportFile(null);
                        }
                      }}
                      onRemove={() => setVivaReportFile(null)}
                      maxCount={1}
                      accept=".pdf,.doc,.docx"
                      fileList={vivaReportFile ? [vivaReportFile] : []}
                    >
                      <Button icon={<UploadOutlined />} size="small">Choose File</Button>
                    </Upload>
                    )}
                   
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <strong>Examiner Remarks</strong> {uploadDecision === '2' && <span style={{ color: 'red', fontSize: '11px' }}>(Mandatory for Not Awarded)</span>}
                  </td>
                  <td style={{ ...cellStyle, padding: '6px' }}>
                    <TextArea
                      rows={3}
                      value={examinerRemarks}
                      onChange={(e) => setExaminerRemarks(e.target.value)}
                      placeholder="Enter remarks..."
                      style={{ width: '100%', fontSize: '12px' }}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle, padding: '8px' }} colSpan="2" align="center">
                    {canupdate && (
                       <Button 
                      type="primary" 
                      loading={uploadLoading}
                      style={{ 
                        backgroundColor: '#52c41a', 
                        borderColor: '#52c41a',
                        padding: '6px 24px',
                        height: '32px',
                        fontSize: '13px'
                      }}
                      onClick={handleVivaStatusUpdate}
                    >
                      Update Viva Status for DoR Approval
                    </Button>
                    )}
                   
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <br />
        {/* Remove the old modal code */}
      </div>

      {/* PDF Preview Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{currentPdfTitle}</span>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleOpenInNewTab}
              size="small"
            >
              Open in New Tab
            </Button>
          </div>
        }
        open={pdfModalVisible}
        onCancel={() => setPdfModalVisible(false)}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button key="close" onClick={() => setPdfModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="newTab"
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleOpenInNewTab}
          >
            Open in New Tab
          </Button>
        ]}
      >
        <div style={{ height: '70vh', width: '100%' }}>
          {currentPdfUrl && (
            <iframe
              src={currentPdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '4px'
              }}
              title="PDF Preview"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EditVivaapprovals;