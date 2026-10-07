import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Modal, Form, Input, Select, DatePicker, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';

const { Option } = Select;

const Chapters = () => {
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
      const response = await API.get(`SupervisorCategories/BySupervisor?supid=${supId}&id=4`);
      setData(response.data || []);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      notification().error('Failed to load chapters');
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
      pubType: record.pubType,
      titleOfBook: record.titleOfBook,
      titleOfChapter: record.titleOfChapter,
      nameAndAddress: record.nameAndAddress,
      yearOfPub: record.yearOfPub ? dayjs(record.yearOfPub, 'YYYY') : null,
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
        yearOfPub: values.yearOfPub.format('YYYY'),
        supId: supId,
        categoryId: 4, // categoryId for chapters
      };

      if (editingRecord) {
        // Update existing record - include id in payload
        payload.id = editingRecord.id;
        await API.put(`/SupervisorCategories/${editingRecord.id}`, payload);
        notify.success('Chapter updated successfully');
      } else {
        // Create new record
        await API.post('/SupervisorCategories', payload);
        notify.success('Chapter added successfully');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error saving chapter:', error);
      notify.error('Failed to save chapter');
    }
  };

  const handleDelete = async (record) => {
    try {
      await API.delete(`/SupervisorCategories/${record.id}`);
      notify.success('Chapter deleted successfully');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting chapter:', error);
      notify.error('Failed to delete chapter');
    }
  };

  const getPublicationTypeLabel = (pubType) => {
    switch (pubType) {
      case 'national': return 'National';
      case 'international': return 'International';
      default: return pubType || 'N/A';
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
      title: 'Title of Book & Chapter Name',
      key: 'bookAndChapter',
      width: 350,
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Book:</strong> {record.titleOfBook || 'N/A'}</div>
          <div><strong>Chapter:</strong> {record.titleOfChapter || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <div className="space-y-1">
          <div><strong>Publication Type:</strong> {getPublicationTypeLabel(record.pubType)}</div>
          <div><strong>Year:</strong> {record.yearOfPub || 'N/A'}</div>
          <div><strong>Publisher:</strong> {record.nameAndAddress || 'N/A'}</div>
          <div><strong>ISBN No.:</strong> {record.isbn || 'N/A'}</div>
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
            title="Are you sure you want to delete this chapter?"
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
            Chapters
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
        title={editingRecord ? 'Edit Chapter' : 'Add New Chapter'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={700}
        okText={editingRecord ? 'Update' : 'Add'}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="pubType"
            label="Publication Type"
            rules={[{ required: true, message: 'Please select publication type' }]}
          >
            <Select placeholder="Select publication type">
              <Option value="national">National</Option>
              <Option value="international">International</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="titleOfBook"
            label="Title of the Book"
            rules={[{ required: true, message: 'Please enter title of the book' }]}
          >
            <Input placeholder="Enter title of the book" />
          </Form.Item>

          <Form.Item
            name="titleOfChapter"
            label="Title of the Chapter"
            rules={[{ required: true, message: 'Please enter title of the chapter' }]}
          >
            <Input placeholder="Enter title of the chapter" />
          </Form.Item>

          <Form.Item
            name="nameAndAddress"
            label="Name & Address of Publisher"
            rules={[{ required: true, message: 'Please enter name & address of publisher' }]}
          >
            <Input.TextArea
              placeholder="Enter name & address of publisher"
              rows={3}
            />
          </Form.Item>

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
            name="isbn"
            label="ISBN No."
            rules={[{ required: true, message: 'Please enter ISBN number' }]}
          >
            <Input placeholder="Enter ISBN number" />
          </Form.Item>

          <Form.Item
            name="doiNumber"
            label="DOI No."
          >
            <Input placeholder="Enter DOI number (optional)" />
          </Form.Item>

          <Form.Item
            name="citations"
            label="Citation"
          >
            <Input placeholder="Enter citation (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Chapters;