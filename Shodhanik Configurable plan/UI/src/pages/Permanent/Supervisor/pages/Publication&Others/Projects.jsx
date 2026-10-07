import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Modal, Form, Input, DatePicker, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';

const Projects = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=7`);
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      notification().error('Failed to load projects');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/supervisor-dashboard/publications-papers');
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      yearOfPub: record.yearOfPub ? dayjs(record.yearOfPub, 'YYYY') : null,
      nameOfProject: record.nameOfProject,
      fundingAgency: record.fundingAgency,
      amount: record.amount,
      from: record.from ? dayjs(record.from) : null,
      to: record.to ? dayjs(record.to) : null,
    });
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Validate that from date is less than to date
      if (values.from && values.to && values.from.isAfter(values.to)) {
        notification().error('From date must be less than To date');
        return;
      }
      
      const payload = {
        ...values,
        yearOfPub: values.yearOfPub ? values.yearOfPub.format('YYYY') : null,
        from: values.from ? values.from.format('YYYY-MM-DD') : null,
        to: values.to ? values.to.format('YYYY-MM-DD') : null,
        supId: supId,
        categoryId: 7, // Assuming categoryId for projects
      };

      if (editingRecord) {
        // Update existing record - include id in payload
        payload.id = editingRecord.id;
        await API.put(`/SupervisorCategories/${editingRecord.id}`, payload);
        notification().success('Project updated successfully');
      } else {
        // Create new record
        await API.post('/SupervisorCategories', payload);
        notification().success('Project added successfully');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error saving project:', error);
      notification().error('Failed to save project');
    }
  };

  const handleDelete = async (record) => {
    try {
      await API.delete(`/SupervisorCategories/${record.id}`);
      notification().success('Project deleted successfully');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting project:', error);
      notification().error('Failed to delete project');
    }
  };

  const formatDateRange = (fromDate, toDate) => {
    if (!fromDate && !toDate) return 'N/A';
    const from = fromDate ? dayjs(fromDate).format('DD-MM-YYYY') : 'N/A';
    const to = toDate ? dayjs(toDate).format('DD-MM-YYYY') : 'N/A';
    return `${from} to ${to}`;
  };

  const formatAmount = (amount) => {
    if (!amount) return 'N/A';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srno',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Project Name',
      dataIndex: 'nameOfProject',
      key: 'nameOfProject',
      width: 300,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Year:</strong> {record.yearOfPub || 'N/A'}</div>
          <div><strong>Funding Agency:</strong> {record.fundingAgency || 'N/A'}</div>
          <div><strong>Amount:</strong> {formatAmount(record.amount)}</div>
          <div><strong>Period:</strong> {formatDateRange(record.from, record.to)}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this project?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          onClick={handleBack} 
          icon={<ArrowLeftOutlined />}
          className="mb-4"
        >
          Back to Categories
        </Button>
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            Projects
          </h2>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            Add New
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add/Edit Modal */}
      <Modal
        title={editingRecord ? 'Edit Project' : 'Add New Project'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText={editingRecord ? 'Update' : 'Add'}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="yearOfPub"
            label="Year"
            rules={[{ required: true, message: 'Please select year' }]}
          >
            <DatePicker
              picker="year"
              style={{ width: '100%' }}
              placeholder="Select year"
            />
          </Form.Item>

          <Form.Item
            name="nameOfProject"
            label="Name of Project"
            rules={[{ required: true, message: 'Please enter name of project' }]}
          >
            <Input placeholder="Enter name of project" />
          </Form.Item>

          <Form.Item
            name="fundingAgency"
            label="Funding Agency"
            rules={[{ required: true, message: 'Please enter funding agency' }]}
          >
            <Input placeholder="Enter funding agency" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (₹)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <Input 
              placeholder="Enter amount" 
              type="number"
              prefix="₹"
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="from"
              label="From"
              rules={[{ required: true, message: 'Please select from date' }]}
            >
              <DatePicker 
                placeholder="Select from date"
                format="DD-MM-YYYY"
                className="w-full"
                onChange={() => {
                  // Clear validation errors when date changes
                  form.validateFields(['to']);
                }}
              />
            </Form.Item>

            <Form.Item
              name="to"
              label="To"
              rules={[
                { required: true, message: 'Please select to date' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const fromDate = getFieldValue('from');
                    if (!value || !fromDate || fromDate.isBefore(value) || fromDate.isSame(value)) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('To date must be greater than or equal to From date'));
                  },
                }),
              ]}
            >
              <DatePicker 
                placeholder="Select to date"
                format="DD-MM-YYYY"
                className="w-full"
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;