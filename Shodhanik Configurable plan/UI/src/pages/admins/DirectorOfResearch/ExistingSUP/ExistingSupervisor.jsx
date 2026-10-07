import { useState, useEffect } from 'react';
import { Table, Input, Card, Space, Typography, message, Modal, Form, Button as AntButton } from 'antd';
import { SearchOutlined, DownloadOutlined, EditOutlined, MailOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import API from '@/services/API';
import Button from '@/components/ui/Button';
import {hasPermission} from '@/services/hasPermissionService';

import notification from '@/services/NotificationService';

const { Title } = Typography;
const { Search } = Input;

const ExistingSupervisor = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);
 const canview = hasPermission('existingsup.read');
 const canedit = hasPermission('existingsup.update');
 const candownload = hasPermission('existingsup.download');
  // Fetch existing supervisors data
  useEffect(() => {
    fetchSupervisorsData();
  }, []);

  const fetchSupervisorsData = async () => {
    try {
      setLoading(true);
      const response = await API.get('/Dor/ExistingSupervisor');
      
      // Add serial numbers to the data
      const dataWithSerialNumbers = response.data.map((item, index) => ({
        ...item,
        key: item.supId,
        srNo: index + 1,
      }));
      
      setData(dataWithSerialNumbers);
      setFilteredData(dataWithSerialNumbers);
    } catch (error) {
      console.error('Error fetching supervisors data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    if (!value) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item =>
        item.fullName.toLowerCase().includes(value.toLowerCase()) ||
        item.email.toLowerCase().includes(value.toLowerCase()) ||
        item.permUserName.toLowerCase().includes(value.toLowerCase()) ||
        item.mobileNo.includes(value)
      );
      setFilteredData(filtered);
    }
  };

  // Download Excel
  const downloadExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredData.map(item => ({
        'Sr. No.': item.srNo,
        'User ID': item.permUserName,
        'Name': item.fullName,
        'Designation': getDesignationName(item.designation),
        'Department': getSubjectName(item.primarySuperviseSubject),
        'Mobile No.': item.mobileNo,
        'Email': item.email,
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sr. No.
        { wch: 15 }, // User ID
        { wch: 25 }, // Name
        { wch: 20 }, // Designation
        { wch: 30 }, // Department
        { wch: 15 }, // Mobile No.
        { wch: 30 }, // Email
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Approved Supervisors');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Approved_Supervisors_${currentDate}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      notification().success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      notification().error('Failed to download Excel file');
    }
  };

  // Helper functions for display names (you may need to adjust these based on your data)
  const getDesignationName = (designationId) => {
    const designations = {
      1: 'Associate Professor',
      2: 'Assistant Professor',
      3: 'Professor',
      // Add more designations as needed
    };
    return designations[designationId] || `Designation ${designationId}`;
  };

  const getSubjectName = (subjectId) => {
    const subjects = {
      1: 'Ancient History and Culture / History',
      2: 'Applied and Reg. Economics / Economics',
      3: 'Applied Chemistry / Chemistry',
      // Add more subjects as needed
    };
    return subjects[subjectId] || `Subject ${subjectId}`;
  };

  // Handle edit supervisor
  const handleEdit = (record) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      email: record.email,
      mobileNo: record.mobileNo,
    });
    setEditModalVisible(true);
  };

  // Handle update supervisor
  const handleUpdate = async (values) => {
    try {
      setUpdating(true);
      
      const updateData = {
        email: values.email,
        mobileNo: values.mobileNo,
      };

      await API.patch(`/Dor/ExistingSupervisor/${editingRecord.supId}`, updateData);
      
      notification().success('Supervisor updated successfully!');
      setEditModalVisible(false);
      editForm.resetFields();
      setEditingRecord(null);
      
      // Refresh data
      await fetchSupervisorsData();
    } catch (error) {
      console.error('Error updating supervisor:', error);
      notification().error('Failed to update supervisor');
    } finally {
      setUpdating(false);
    }
  };

  // Handle send password email
  const handleSendPassword = async (record) => {
    try {
      // Assuming there's an API endpoint for sending password
      // await API.post(`/Dor/SendPassword/${record.supId}`);
      notification().success(`Password sent to ${record.email}`);
    } catch (error) {
      console.error('Error sending password:', error);
      notification().error('Failed to send password');
    }
  };

  // Handle view profile
  const handleViewProfile = (record) => {
    // Navigate to profile page or show profile modal
    console.log('View profile:', record);
    notification().info(`Viewing profile for ${record.fullName}`);
  };

  // Table columns configuration
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.srNo - b.srNo,
    },
    {
      title: 'User ID',
      dataIndex: 'permUserName',
      key: 'permUserName',
      width: 150,
      sorter: (a, b) => a.permUserName.localeCompare(b.permUserName),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search User ID"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              module="general"
              label="Search"
              size="sm"
              onClick={() => confirm()}
            />
            <Button
              module="general"
              label="Reset"
              size="sm"
              variant="outline"
              onClick={() => {
                clearFilters();
                confirm();
              }}
            />
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value, record) =>
        record.permUserName.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Name',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 200,
      sorter: (a, b) => a.fullName.localeCompare(b.fullName),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search Name"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              module="general"
              label="Search"
              size="sm"
              onClick={() => confirm()}
            />
            <Button
              module="general"
              label="Reset"
              size="sm"
              variant="outline"
              onClick={() => {
                clearFilters();
                confirm();
              }}
            />
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value, record) =>
        record.fullName.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      width: 180,
      render: (designation) => getDesignationName(designation),
      sorter: (a, b) => a.designation - b.designation,
    },
    {
      title: 'Department',
      dataIndex: 'primarySuperviseSubject',
      key: 'primarySuperviseSubject',
      width: 250,
      render: (subjectId) => getSubjectName(subjectId),
    },
    {
      title: 'Mobile No.',
      dataIndex: 'mobileNo',
      key: 'mobileNo',
      width: 130,
      align: 'center',
    },
    {
      title: 'Profile',
      key: 'profile',
      width: 80,
      align: 'center',
      render: (_, record) => (
        canview && (
          <Button
          module="general"
          action="read"
          label="View"
          size="sm"
          variant="outline"
          onClick={() => handleViewProfile(record)}
        />
        )
        
      ),
    },
    {
      title: 'Edit',
      key: 'edit',
      width: 80,
      align: 'center',
      render: (_, record) => (
        canedit && (
          <Button
          module="general"
          action="update"
          label="Edit"
          size="sm"
          onClick={() => handleEdit(record)}
        />
        )
        
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2} className="!mb-0">
            Approved Supervisors
          </Title>
          {candownload && (
            <Button
            module="general"
            label="Download"
            icon={<DownloadOutlined />}
            onClick={downloadExcel}
            variant="solid"
            className="bg-green-600 hover:bg-green-700 border-green-600"
          />
          )}
          
        </div>
        
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Search
            placeholder="Search supervisors..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
          />
          <div className="text-gray-600">
            Total Supervisors: <span className="font-semibold">{filteredData.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} supervisors`,
            pageSizeOptions: ['15', '25', '50', '100'],
          }}
          scroll={{ x: 1200 }}
          size="middle"
          bordered
          className="supervisors-table"
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <EditOutlined />
            <span>Edit Supervisor Details</span>
          </div>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setEditingRecord(null);
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {editingRecord && (
          <div className="space-y-6">
            {/* Read-only fields */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shodhanik ID <span className="text-red-500">*</span>
                </label>
                <Input
                  value={editingRecord.permUserName}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={editingRecord.fullName}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>

            {/* Editable form */}
            <Form
              form={editForm}
              layout="vertical"
              onFinish={handleUpdate}
              className="space-y-4"
            >
              <Form.Item
                name="mobileNo"
                label={
                  <span>
                    Mobile No <span className="text-red-500">*</span>
                  </span>
                }
                rules={[
                  { required: true, message: 'Please enter mobile number' },
                  { pattern: /^[0-9]{10}$/, message: 'Please enter valid 10-digit mobile number' }
                ]}
              >
                <Input
                  placeholder="Enter mobile number"
                  maxLength={10}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={
                  <span>
                    Email ID <span className="text-red-500">*</span>
                  </span>
                }
                rules={[
                  { required: true, message: 'Please enter email address' },
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input
                  placeholder="Enter email address"
                />
              </Form.Item>

              {/* Action buttons */}
              <div className="flex justify-between pt-4">
                <AntButton
                  type="default"
                  icon={<MailOutlined />}
                  onClick={() => handleSendPassword(editingRecord)}
                  className="bg-green-500 hover:bg-green-600 text-white border-green-500"
                >
                  Send Password on Email
                </AntButton>
                
                <div className="space-x-2">
                  <AntButton
                    onClick={() => {
                      setEditModalVisible(false);
                      editForm.resetFields();
                      setEditingRecord(null);
                    }}
                  >
                    Cancel
                  </AntButton>
                  <AntButton
                    type="primary"
                    htmlType="submit"
                    loading={updating}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Update
                  </AntButton>
                </div>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      <style>
        {`
          .supervisors-table .ant-table-thead > tr > th {
            background-color: #f8f9fa !important;
            font-weight: 600 !important;
            color: #495057 !important;
          }
          
          .supervisors-table .ant-table-tbody > tr:hover > td {
            background-color: #f8f9fa !important;
          }
          
          .supervisors-table .ant-pagination {
            margin-top: 16px !important;
          }
        `}
      </style>
    </div>
  );
};

export default ExistingSupervisor;