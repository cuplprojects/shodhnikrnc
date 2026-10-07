import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import dayjs from 'dayjs';
import notification from '@/services/NotificationService';

const AuthoredBooksMonographs = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  const notify = notification();
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Replace with actual API endpoint for authored books
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=1`);
      const publications = Array.isArray(response.data) ? response.data : response.data.data || [];
      setData(publications);
    } catch (error) {
      console.error('Error fetching authored books data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srno',
      render: (_, __, index) => index + 1,
      width: 80,
    },
    {
      title: 'Name of Book',
      dataIndex: 'nameOfBook',
      key: 'nameOfBook',
      width: 200,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div>
          <div><strong>Year of Publication:</strong> {record.yearOfPub}</div>
          <div><strong>ISBN No.:</strong> {record.isbn}</div>
          <div><strong>Publisher:</strong> {record.publisher}</div>
        </div>
      ),
      width: 400,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
      width: 100,
    },
  ];

  const handleBack = () => {
    navigate('/supervisor-dashboard/publications-papers');
  };

  const handleAddNew = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      nameOfBook: record.nameOfBook,
      yearOfPub: record.yearOfPub ? dayjs(record.yearOfPub, 'YYYY') : null,
      publisher: record.publisher,
      isbn: record.isbn,
      doiNumber: record.doiNumber,
      citations: record.citations,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`SupervisorCategories/${id}`);
      notify.success('Record deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting record:', error);
      notify.error('Failed to delete record');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        id: editingRecord?.id || 0,
        categoryId: 1, // Authored Books & Monographs category ID
        supId: supId || 0,
        // Only send the fields that are actually used in the UI
        nameOfBook: values.nameOfBook,
        yearOfPub: values.yearOfPub ? values.yearOfPub.format('YYYY') : null,
        publisher: values.publisher,
        isbn: values.isbn,
        doiNumber: values.doiNumber || '',
        citations: values.citations || ''
      };

      if (editingRecord) {
        await API.put(`SupervisorCategories/${editingRecord.id}`, payload);
        notify.success('Record updated successfully');
      } else {
        await API.post('SupervisorCategories', payload);
        notify.success('Record added successfully');
      }

      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Error saving record:', error);
      notify.error('Failed to save record');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button
          onClick={handleBack}
          icon={<ArrowLeftOutlined />}
          className="mb-4"
        >
          Back to Publications
        </Button>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            Authored Books & Monographs
          </h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddNew}
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
            `Showing ${range[0]} to ${range[1]} of ${total} entries`,
          pageSizeOptions: ['10', '25', '50', '100'],
        }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingRecord ? "Edit Record" : "Add New Record"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="nameOfBook"
            label={<span>Name of Book <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the name of book' }]}
          >
            <Input placeholder="Enter name of book" />
          </Form.Item>

          <Form.Item
            name="yearOfPub"
            label={<span>Year of Publication <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please select the year of publication' }]}
          >
            <DatePicker
              picker="year"
              style={{ width: '100%' }}
              placeholder="Select year"
            />
          </Form.Item>

          <Form.Item
            name="publisher"
            label={<span>Publisher <span style={{ color: 'red' }}>*</span></span>}
            rules={[{ required: true, message: 'Please enter the publisher' }]}
          >
            <Input placeholder="Enter publisher" />
          </Form.Item>

          <Form.Item
            name="isbn"
            label="ISBN No"
          >
            <Input placeholder="Enter ISBN number" />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {editingRecord ? 'Update' : 'Submit'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AuthoredBooksMonographs;