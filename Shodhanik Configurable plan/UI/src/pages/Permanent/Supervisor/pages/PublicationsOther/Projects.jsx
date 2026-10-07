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
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=3`);
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
      year: record.year,
      nameOfProject: record.nameOfProject,
      fundingAgency: record.fundingAgency,
      amount: record.amount,
      fromDate: record.fromDate ? dayjs(record.fromDate) : null,
      tillDate: record.tillDate ? dayjs(record.tillDate) : null,
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
      const payload = {
        ...values,
        fromDate: values.fromDate ? values.fromDate.format('YYYY-MM-DD') : null,
        tillDate: values.tillDate ? values.tillDate.format('YYYY-MM-DD') : null,
        supId: supId,
        categoryId: 3, // Assuming categoryId for projects
      };

      if (editingRecord) {
        // Update existing record
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

  const formatDateRange = (fromDate, tillDate) => {
    if (!fromDate && !tillDate) return 'N/A';
    const from = fromDate ? dayjs(fromDate).format('DD-MM-YYYY') : 'N/A';
    const till = tillDate ? dayjs(tillDate).format('DD-MM-YYYY') : 'N/A';
    return `${from} to ${till}`;
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
          <div><strong>Year:</strong> {record.year || 'N/A'}</div>
          <div><strong>Funding Agency:</strong> {record.fundingAgency || 'N/A'}</div>
          <div><strong>Amount:</strong> {formatAmount(record.amount)}</div>
          <div><strong>Period:</strong> {formatDateRange(record.fromDate, record.tillDate)}</div>
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
            name="year"
            label="Year"
            rules={[{ required: true, message: 'Please enter year' }]}
          >
            <Input placeholder="Enter year" maxLength={4} />
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
              name="fromDate"
              label="From"
              rules={[{ required: true, message: 'Please select from date' }]}
            >
              <DatePicker 
                placeholder="Select from date"
                format="DD-MM-YYYY"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="tillDate"
              label="Till"
              rules={[{ required: true, message: 'Please select till date' }]}
            >
              <DatePicker 
                placeholder="Select till date"
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

export default EditedBooks;