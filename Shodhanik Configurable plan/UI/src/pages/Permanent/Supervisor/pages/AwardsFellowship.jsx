import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Table, Modal, Input, Form, Button, Space, DatePicker } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';



const AwardsFellowship = () => {
  const [awards, setAwards] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { getSupId } = useSupervisorAuthStore();
  const SUPERVISOR_ID = getSupId();

  /* ===================== GET ===================== */
  useEffect(() => {
    getAwards();
  }, []);

  const getAwards = async () => {
    setLoading(true);
    try {
      const res = await API.get(
        `/SupervisorAwards/BySupervisor?supId=${SUPERVISOR_ID}`
      );
      setAwards(res.data);
    } catch (err) {
      console.error('Failed to fetch awards', err);
    } finally {
      setLoading(false);
    }
  };

  /* ===================== TABLE COLUMNS ===================== */
  const columns = [
    {
      title: 'S.No',
      key: 'sno',
      width: 70,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Award / Fellowship',
      dataIndex: 'fellowship',
      key: 'fellowship',
    },
    {
      title: 'Agency / Department',
      dataIndex: 'agency',
      key: 'agency',
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  /* ===================== POST ===================== */
  const postAward = async (data) => {
    const res = await API.post('/SupervisorAwards', {
      supId: SUPERVISOR_ID,
      ...data,
    });
    return res.data;
  };

  /* ===================== PUT ===================== */
  const updateAward = async (id, data) => {
    const res = await API.put(`/SupervisorAwards/${id}`, {
      supId: SUPERVISOR_ID,
      id: editingItem.id,
      ...data,
    });
    return res.data;
  };

  /* ===================== DELETE ===================== */
  const deleteAward = async (id) => {
    await API.delete(`/SupervisorAwards/${id}`);
  };

  /* ===================== MODAL HANDLERS ===================== */
  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (award) => {
    setEditingItem(award);
    form.setFieldsValue({
      fellowship: award.fellowship,
      agency: award.agency,
      year: award.year ? dayjs(award.year, 'YYYY') : null,
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  /* ===================== SUBMIT ===================== */
  const handleSubmit = async (values) => {
    const yearValue = values.year ? dayjs(values.year).format('YYYY') : null;
    const enteredYear = Number(yearValue);
    const currentYear = new Date().getFullYear();

    // adjust 1950 if needed
    if (enteredYear > currentYear) {
      notification().warning(
        `Year must be less than ${currentYear}`
      );
      return;
    }

    const submitData = {
      ...values,
      year: yearValue
    };

    try {
      if (editingItem) {
        const updated = await updateAward(editingItem.id, submitData);
        setAwards((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
        notification().success('Award record updated successfully');
      } else {
        const created = await postAward(submitData);
        setAwards((prev) => [...prev, created]);
        notification().success('Award record added successfully');
      }
      getAwards();
      handleModalClose();
    } catch (err) {
      console.error('Save failed', err);
      notification().error('Failed to save award record');
    }
  };

  /* ===================== DELETE ===================== */
  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Award Record',
      message: 'Are you sure you want to delete this award record? This action cannot be undone.'
    });

    if (!confirmed) return;

    try {
      await deleteAward(id);
      setAwards((prev) => prev.filter((a) => a.id !== id));
      getAwards();
      notification().success('Award record deleted successfully');
    } catch (err) {
      console.error('Delete failed', err);
      notification().error('Failed to delete award record');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Awards & Fellowships
          </h1>
          <p className="text-gray-600">
            Your achievements, awards, and fellowships
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
                     text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Award
        </button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={awards}
        rowKey="id"
        loading={loading}
        bordered
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        }}
      />

      {/* Modal */}
      <Modal
        title={editingItem ? 'Edit Award' : 'Add Award'}
        open={isModalOpen}
        onCancel={handleModalClose}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="fellowship"
            label="Award / Fellowship Name"
            rules={[
              { required: true, message: 'Award / Fellowship name is required' },
              { whitespace: true, message: 'Cannot be empty' },
              {
                pattern: /^[a-zA-Z\s&\-().,]+$/,
                message: 'Only alphabetic characters, spaces, and special characters (&, -, (), ., ,) are allowed. Numbers are not permitted.',
              },
            ]}
          >
            <Input placeholder="Enter award or fellowship name" />
          </Form.Item>

          <Form.Item
            name="agency"
            label="Agency / Department"
            rules={[
              { required: true, message: 'Agency is required' },
              { whitespace: true, message: 'Cannot be empty' },
              {
                pattern: /^[a-zA-Z\s&\-().,]+$/,
                message: 'Only alphabetic characters, spaces, and special characters (&, -, (), ., ,) are allowed. Numbers are not permitted.',
              },
            ]}
          >
            <Input placeholder="Enter agency or department" />
          </Form.Item>

          <Form.Item
            name="year"
            label="Year"
            rules={[
              { required: true, message: 'Year is required' },
            ]}
          >
            <DatePicker 
              picker="year" 
              placeholder="Select year"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current.year() > dayjs().year()}
            />
          </Form.Item>

          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={handleModalClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              {editingItem ? 'Update' : 'Add'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AwardsFellowship;
