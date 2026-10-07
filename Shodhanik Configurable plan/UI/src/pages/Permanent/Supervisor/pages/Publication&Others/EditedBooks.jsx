import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Modal, Form, Input, DatePicker, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';

const EditedBooks = () => {
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
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=2`);
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching edited books:', error);
      notification().error('Failed to load edited books');
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
      nameOfBook: record.nameOfBook,
      yearOfPub: record.yearOfPub ? dayjs(record.yearOfPub, 'YYYY') : null,
      title: record.title,
      publisher: record.publisher,
      isbn: record.isbn,
      doiNumber: record.doiNumber,
      citations: record.citations,
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
        yearOfPub: values.yearOfPub ? values.yearOfPub.format('YYYY') : null,
        supId: supId,
        categoryId: 2, // Assuming categoryId for edited books
      };

      if (editingRecord) {
        // Update existing record - include id in payload
        payload.id = editingRecord.id;
        await API.put(`/SupervisorCategories/${editingRecord.id}`, payload);
        notification().success('Book updated successfully');
      } else {
        // Create new record
        await API.post('/SupervisorCategories', payload);
        notification().success('Book added successfully');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error saving book:', error);
      notification().error('Failed to save book');
    }
  };

  const handleDelete = async (record) => {
    try {
      await API.delete(`/SupervisorCategories/${record.id}`);
      notification().success('Book deleted successfully');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting book:', error);
      notification().error('Failed to delete book');
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srno',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Name of Book',
      dataIndex: 'nameOfBook',
      key: 'nameOfBook',
      width: 300,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Year of Publication:</strong> {record.yearOfPub || 'N/A'}</div>
          <div><strong>Publisher:</strong> {record.publisher || 'N/A'}</div>
          <div><strong>ISBN:</strong> {record.isbn || 'N/A'}</div>
          <div><strong>DOI No.:</strong> {record.doiNumber || 'N/A'}</div>
          <div><strong>Citations:</strong> {record.citations || 'N/A'}</div>
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
            title="Are you sure you want to delete this book?"
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
            Edited Books
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
        title={editingRecord ? 'Edit Book' : 'Add New Book'}
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
            name="nameOfBook"
            label="Name of Book"
            rules={[{ required: true, message: 'Please enter name of book' }]}
          >
            <Input placeholder="Enter name of book" />
          </Form.Item>

          <Form.Item
            name="yearOfPub"
            label="Year of Publication"
            rules={[{ required: true, message: 'Please select year of publication' }]}
          >
            <DatePicker
              picker="year"
              style={{ width: '100%' }}
              placeholder="Select year"
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="Enter title" />
          </Form.Item>

          <Form.Item
            name="publisher"
            label="Publisher"
            rules={[{ required: true, message: 'Please enter publisher' }]}
          >
            <Input placeholder="Enter publisher" />
          </Form.Item>

          <Form.Item
            name="isbn"
            label="ISBN"
            rules={[{ required: true, message: 'Please enter ISBN' }]}
          >
            <Input placeholder="Enter ISBN" />
          </Form.Item>

          <Form.Item
            name="doiNumber"
            label="DOI No."
            rules={[{ required: true, message: 'Please enter DOI number' }]}
          >
            <Input placeholder="Enter DOI number" />
          </Form.Item>

          <Form.Item
            name="citations"
            label="Citations"
            rules={[{ required: true, message: 'Please enter citations' }]}
          >
            <Input placeholder="Enter citations" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EditedBooks;