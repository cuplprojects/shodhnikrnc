import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Card, Modal, Upload, Form, Space } from 'antd';
import { DownloadOutlined, UploadOutlined, InboxOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import notification from '@/services/NotificationService';
import API from '@/services/API';
import { useNavigate } from 'react-router-dom';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const { Dragger } = Upload;

const ProgressReports = () => {
  const [reportsData, setReportsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  
  const { getSId } = useSelectedScholarAuthStore();
  const navigate = useNavigate();

  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const sId = getSId();
      
      if (!sId) {
        setError('Scholar ID not found');
        return;
      }

      // Fetch progress reports from API
      const response = await API.get(`/ProgressReports/by-sid/${sId}`);
      
      if (response.data && Array.isArray(response.data)) {
        // Sort reports by prid
        const sortedReports = [...response.data].sort((a, b) => a.prid - b.prid);

        const formattedData = sortedReports.map((report, index) => ({
          key: report.prid,
          prid: report.prid,
          sno: index + 1,
          title: report.prTitle || `Progress Report - ${index + 1}`,
          lastDate: report.lastDate ? new Date(report.lastDate).toLocaleDateString('en-GB') : '-',
          supervisorStatus: report.isApprovedbySupervisor === 1 ? 'Approved' : 
                          report.isApprovedbySupervisor === 2 ? 'Rejected' : 'Pending',
          reportFilePath: report.reportFilePath,
          uploadDate: report.uploadDate,
          isApprovedbySupervisor: report.isApprovedbySupervisor,
          supervisorComments: report.supervisorComments,
        }));
        setReportsData(formattedData);
        console.log(reportsData)
        setError(null);
      } else {
        setReportsData([]);
      }
    } catch (err) {
      console.error('Error fetching reports data:', err);
      if (err.response?.status === 404) {
        setReportsData([]);
        setError(null);
      } else {
        setError('Failed to load progress reports');
        const notify = notification();
        notify.error('Failed to load progress reports');
      }
    } finally {
      setLoading(false);
    }
  }, [getSId]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  const handleDownloadFormat = () => {
    navigate('/scholar-dashboard/progress-reports/progressreportformat');
  };

  const handleUpload = (record) => {
    setSelectedReport(record);
    setUploadModalVisible(true);
    form.resetFields();
  };

  const handleView = (record) => {
    setSelectedReport(record);
    setViewModalVisible(true);
  };

  const handleOpenInNewTab = () => {
    if (selectedReport?.reportFilePath) {
      const fileUrl = `${getBaseFileURL()}/${selectedReport.reportFilePath}`;
      window.open(fileUrl, '_blank');
    }
  };

  const handleUploadSubmit = async (values) => {
    if (!selectedReport || !values.reportFile) {
      const notify = notification();
      notify.error('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('ReportFile', values.reportFile.file);
      
      if (selectedReport.isApprovedbySupervisor === 2) {
        formData.append('isApprovedbySupervisor', 0);
      }

      // Use PATCH API to update the progress report
      const response = await API.patch(`/ProgressReports/${selectedReport.prid}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data) {
        const notify = notification();
        notify.success('Progress report uploaded successfully');
        setUploadModalVisible(false);
        form.resetFields();
        
        // Refresh the data
        await fetchReportsData();
      }
    } catch (error) {
      console.error('Error uploading progress report:', error);
      const notify = notification();
      notify.error('Failed to upload progress report');
    } finally {
      setUploading(false);
    }
  };

  const handleModalCancel = () => {
    setUploadModalVisible(false);
    setSelectedReport(null);
    form.resetFields();
  };

  const handleViewModalCancel = () => {
    setViewModalVisible(false);
    setSelectedReport(null);
  };

  const columns = [
    {
      title: 'S.No.',
      dataIndex: 'sno',
      key: 'sno',
      width: 80,
      align: 'center',
    },
    {
      title: 'Progress Report Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 80
    },
    {
      title: 'Last Date',
      dataIndex: 'lastDate',
      key: 'lastDate',
      width: 120,
      align: 'center',
    },
    {
      title: 'RAC status',
      dataIndex: 'supervisorStatus',
      key: 'supervisorStatus',
      width: 150,
      align: 'center',
      render: (text) => (
        <span className={
          text === 'Approved' ? 'text-green-600 font-medium' :
          text === 'Rejected' ? 'text-red-600 font-medium' : 
          'text-yellow-600 font-medium'
        }>
          {text || 'Pending'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (record.reportFilePath) {
          const isRejected = record.isApprovedbySupervisor === 2;
          
          if (isRejected) {
            // If rejected, show View and Re-upload buttons
            return (
              <Space size="small">
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => handleView(record)}
                  size="small"
                  className="text-blue-600 hover:text-blue-800"
                >
                  View
                </Button>
                <Button
                  type="link"
                  icon={<UploadOutlined />}
                  onClick={() => handleUpload(record)}
                  size="small"
                  className="text-green-600 hover:text-green-800"
                >
                  Re-upload
                </Button>
              </Space>
            );
          } else {
            // If not rejected, show only View button
            return (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
                size="small"
                className="text-blue-600 hover:text-blue-800"
              >
                View
              </Button>
            );
          }
        } else {
          // If no file, show Upload button
          return (
            <Button
              type="link"
              icon={<UploadOutlined />}
              onClick={() => handleUpload(record)}
              size="small"
              className="text-blue-600 hover:text-blue-800"
            >
              Upload
            </Button>
          );
        }
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading progress reports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2 flex justify-between items-center">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Progress Report
          </h1>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadFormat}
            size="small"
            className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
          >
            Download Format
          </Button>
        </div>

        {/* Progress Reports Table */}
        <Card className="shadow-sm" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={reportsData}
            loading={loading}
            pagination={false}
            size="small"
            className="progress-reports-table"
            scroll={{ x: 800 }}
            // locale={{
            //   emptyText: 'No progress reports found'
            // }}
          />
        </Card>
      </div>

      {/* Upload Modal */}
      <Modal
        title={`${selectedReport?.reportFilePath ? 'Re-upload' : 'Upload'} Progress Report - ${selectedReport?.title}`}
        open={uploadModalVisible}
        onCancel={handleModalCancel}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUploadSubmit}
          className="mt-4"
        >
          <Form.Item
            name="reportFile"
            label="Progress Report File"
            rules={[
              { required: true, message: 'Please select a file to upload' }
            ]}
            valuePropName="file"
          >
            <Dragger
              name="file"
              multiple={false}
              accept=".pdf,.doc,.docx"
              beforeUpload={() => false} // Prevent auto upload
              onChange={(info) => {
                if (info.file) {
                  form.setFieldsValue({ reportFile: info });
                }
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">
                Support for PDF, DOC, DOCX files only. Maximum file size: 10MB
              </p>
            </Dragger>
          </Form.Item>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={handleModalCancel}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {selectedReport?.reportFilePath ? 'Re-upload' : 'Upload'} Report
            </Button>
          </div>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={
          <div className="flex justify-between items-center">
            <span>View Progress Report - {selectedReport?.title}</span>
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
        {selectedReport?.reportFilePath && (
          <div className="mt-4">
            <iframe
              src={`${getBaseFileURL()}/${selectedReport.reportFilePath}`}
              width="100%"
              height="600px"
              style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}
              title={`Progress Report - ${selectedReport.title}`}
            >
              <p>Your browser does not support iframes. Please <a href={`${getBaseFileURL()}/${selectedReport.reportFilePath}`} target="_blank" rel="noopener noreferrer">click here to view the document</a>.</p>
            </iframe>
            
            {/* Comments Section */}
            {(selectedReport?.supervisorComments) && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <h4 className="text-lg font-semibold text-slate-800 mb-4">Comments</h4>
                
                {/* Supervisor Comments */}
                {selectedReport?.supervisorComments && (
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <h5 className="font-medium text-slate-700">Supervisor Comments</h5>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {selectedReport.supervisorComments}
                    </p>
                  </div>
                )}
        
              </div>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .progress-reports-table .ant-table-thead > tr > th {
          font-weight: 600;
          color: #334155;
          border-bottom: 1px solid #cbd5e1;
        }
        
        .progress-reports-table .ant-table-tbody > tr:hover > td {
          background-color: #f8fafc !important;
        }
        
        .progress-reports-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 12px;
        }
        
        .progress-reports-table .ant-table-tbody > tr:nth-child(even) > td {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
};

export default ProgressReports;