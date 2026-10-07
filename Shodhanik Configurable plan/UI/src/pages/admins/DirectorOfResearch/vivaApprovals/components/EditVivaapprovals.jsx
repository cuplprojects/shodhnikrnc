import { useState, useEffect } from 'react';
import { Button, Space, message, Input, Select } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import API from '@/services/API'
import notification from '@/services/NotificationService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import {hasPermission} from '@/services/hasPermissionService';


const { TextArea } = Input;
const { Option } = Select;
const notify = notification();

const EditVivaapprovals = ({ selectedRecord, onBack }) => {
  const [candidateData, setCandidateData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finalDecision, setFinalDecision] = useState('');
  const [finalRemarks, setFinalRemarks] = useState('');
  const canApprove = hasPermission('dor_viva_approval.approve');
  const canReject = hasPermission('dor_viva_approval.reject')

  // Get candidate ID from selectedRecord prop
  const candidateId = selectedRecord?.sid || 1; // Default to 1 for demo

  // Fetch award examinee data
  const fetchAwardExamineeData = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/AwardExaminee/${candidateId}`);
      setCandidateData(response.data);
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

  // Handle final decision (Awarded/Not Awarded)
  const handleFinalDecision = (decision) => {
    setFinalDecision(decision);
    // Don't call API immediately, just update state
  };

  // Handle save button click
  const handleSave = () => {
    if (!finalDecision) {
      notify.error('Please select a decision (Approved/Rejected)');
      return;
    }

    if (finalDecision === 'not_awarded' && !finalRemarks.trim()) {
      notify.error('Remarks are mandatory for rejection');
      return;
    }

    submitFinalDecision(finalDecision, finalRemarks);
  };

  // Submit final decision to API
  const submitFinalDecision = async (decision, remarks = '') => {
    try {
      // Get awardID from candidateData (fetched from API)
      const awardID = candidateData[0]?.awardID;

      if (!awardID) {
        notify.error('Award ID not found');
        return;
      }

      const payload = {
        level3ApprovalStatus: decision === 'awarded' ? 1 : 2,
        level3Remark: remarks || (decision === 'awarded' ? 'Approved' : 'Rejected')
      };

      await API.patch(`/AwardExaminee/${awardID}`, payload);

      notify.success(`Decision saved successfully: Candidate ${decision === 'awarded' ? 'approved' : 'rejected'}`);
      setFinalRemarks('');
      setFinalDecision('');
      fetchAwardExamineeData(); // Refresh data
    } catch (error) {
      console.error('Error submitting final decision:', error);
      notify.error('Failed to save decision');
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

  // Check if final decision has been made (verification1Status is 1 or 2)
  const isFinalDecisionMade = candidate?.verification1Status === 1 || candidate?.verification1Status === 2;

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
        <Button icon={<PrinterOutlined />}>
          Print
        </Button>
      </Space>

      {/* Main Table Container */}
      <div style={{ backgroundColor: 'white', padding: '20px', border: '2px solid #000' }}>

        {/* Basic Details Table */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="2">Basic Details</td>
              <td style={rightAlignStyle}>Shodhanik ID : 24PHD024</td>
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

        {/* Viva Report Table */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="3">Viva Report</td>
            </tr>
            <tr>
              <td style={cellStyle} width="150px"><strong>Viva Result</strong></td>
              <td style={cellStyle} width="100px">
                {candidate.uploadDecision === 1 ? 'Approved' : candidate.uploadDecision === 2 ? 'Rejected' : 'Pending'}
              </td>
              <td style={cellStyle}>
                <strong>Viva Report</strong> &nbsp;&nbsp;
                {candidate.awardFilePath ? (
                  <a
                    href={`${getBaseFileURL()}/${candidate.awardFilePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'blue' }}
                  >
                    View Report
                  </a>
                ) : (
                  <span style={{ color: '#999' }}>No Report</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={cellStyle}><strong>Examiner Remarks</strong></td>
              <td style={cellStyle} colSpan="2">{candidate.uploadRemark || '-'}</td>
            </tr>
          </tbody>
        </table>

        <br />

        {/* Viva Report Verification Table */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="4">Viva Report Verification</td>
            </tr>
            <tr>
              <td style={headerCellStyle} width="80px">Sr. No.</td>
              <td style={headerCellStyle} width="150px">Verification Level</td>
              <td style={headerCellStyle} width="100px">Status</td>
              <td style={headerCellStyle}>Remarks</td>
            </tr>
            {[1, 2, 3, 4, 5].map((level) => {
              const statusKey = `level${level}Status`;
              const remarksKey = `level${level}Remark`;
              const status = candidate[statusKey];
              const remarks = candidate[remarksKey];

              return (
                <tr key={level}>
                  <td style={cellStyle}>{level}.</td>
                  <td style={cellStyle}>Level-{level}</td>
                  <td style={cellStyle}>
                    {status === null && 'Pending'}
                    {status === 1 && 'Approved'}
                    {status === 2 && 'Rejected'}
                  </td>
                  <td style={cellStyle}>
                    <span>{remarks || '-'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>


        {/* Final Decision Row */}
        <table style={tableStyle} className='mt-5'>
          <tbody>
            <tr>
              <td style={headerCellStyle} colSpan="3">Final Decision</td>
            </tr>
            {candidate?.level3Status !== null ? (
              // Show read-only decision if already made
              <>
                <tr>
                  <td style={cellStyle} width="120px"><strong>Decision</strong></td>
                  <td style={cellStyle} width="200px">
                    <span style={{
                      color: candidate.level3Status === 1 ? 'green' : 'red',
                      fontWeight: 'bold'
                    }}>
                      {candidate.level3Status === 1 ? '✓ Approved' : '✗ Rejected'}
                    </span>
                  </td>
                  <td style={cellStyle} colSpan="2">
                    <span style={{ color: '#666', fontStyle: 'italic' }}>
                      Decision has been finalized
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle}><strong>Remarks</strong></td>
                  <td style={cellStyle} colSpan="3">
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px'
                    }}>
                      {candidate.level3Remark || 'No remarks provided'}
                    </div>
                  </td>
                </tr>
              </>
            ) : (
              // Show editable form if decision not made
              <>
                <tr>
                  <td style={cellStyle} width="120px"><strong>Decision</strong></td>
                  <td style={cellStyle} width="200px">
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select Decision"
                      value={finalDecision}
                      onChange={handleFinalDecision}
                    >
                      {canApprove && (
                        <Option value="awarded">Approved</Option>
                      )}
                      {canReject && (
                        <Option value="not_awarded">Rejected</Option>
                      )}

                    </Select>
                  </td>
                  <td style={cellStyle} colSpan="2">
                    {finalDecision === 'awarded' && (
                      <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Candidate will be Approved</span>
                    )}
                    {finalDecision === 'not_awarded' && (
                      <span style={{ color: 'red', fontWeight: 'bold' }}>✗ Candidate will be Rejected</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle}><strong>Remarks</strong></td>
                  <td style={cellStyle} colSpan="3">
                    <TextArea
                      rows={3}
                      value={finalRemarks}
                      onChange={(e) => setFinalRemarks(e.target.value)}
                      placeholder={finalDecision === 'not_awarded' ? 'Remarks are mandatory for rejection...' : 'Enter remarks (optional)...'}
                      style={{ width: '100%' }}
                    />
                    {finalDecision === 'not_awarded' && (
                      <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                        * Remarks are mandatory for rejection
                      </div>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle} colSpan="4" align="center">
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleSave}
                        disabled={!finalDecision}
                        loading={loading}
                      >
                        Save Decision
                      </Button>
                      <Button
                        onClick={() => {
                          setFinalDecision('');
                          setFinalRemarks('');
                        }}
                      >
                        Reset
                      </Button>
                    </Space>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Remove the old modal code */}
      </div>
    </div>
  );
};

export default EditVivaapprovals;