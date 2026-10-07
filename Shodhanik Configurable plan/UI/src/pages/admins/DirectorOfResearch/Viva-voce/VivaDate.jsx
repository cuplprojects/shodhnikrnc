import { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Tag, Spin, Modal } from 'antd';
import { Calendar, Check, Edit3 } from 'lucide-react';
import dayjs from 'dayjs';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';


const VivaDate = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const notify = notification();

  // Edit date modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [newDate, setNewDate] = useState(null);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const canedit = hasPermission('viva.update');

  // Fetch candidates from API
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await API.get('/Viva');
      if (response.data && Array.isArray(response.data)) {
        // Filter only records where forwardToDor is true
        const forwardedData = response.data.filter(item => item.forwardToDor === true);

        const transformedData = forwardedData.map((item, index) => ({
          id: item.sid,
          sid: item.sid,
          srNo: index + 1,
          candidateName: item.name,
          shodhanikId: item.permUserName,
          subjectId: item.subject_ID,
          subject: item.subjectName,
          forwardToDor: item.forwardToDor,
          supervisorName: item.supervisorName,
          scheduledDate: item.vivaDate ? dayjs(item.vivaDate) : null,
          vivaDateAccepted: item.vivaDateAccepted,
          vivaDateAcceptedAt: item.vivaDateAcceptedAt ? dayjs(item.vivaDateAcceptedAt) : null,
          status: item.vivaDateAccepted === true ? 'accepted' : 'pending',
        }));
        setCandidates(transformedData);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      notify.error('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Accept the scheduled date
  const handleAcceptDate = async (candidate) => {
    setAcceptingId(candidate.id);

    try {
      const payload = {
        vivaDateAccepted: true,
        forwardToDor: true,
        vivaDate: candidate.scheduledDate.toISOString(),
        vivaDateAcceptedAt: new Date().toISOString(),
        venueDetails: "CCSU"
      };

      const response = await API.patch(`/Viva/update-viva-date/${candidate.sid}`, payload);

      if (response.status === 200) {
        notify.success(`Viva date approved for ${candidate.candidateName}`);
        // Refresh data from API
        await fetchCandidates();
      }
    } catch (error) {
      console.error('Error accepting date:', error);
      notify.error('Failed to approve viva date');
    } finally {
      setAcceptingId(null);
    }
  };

  // Open edit date modal
  const handleOpenEditModal = (candidate) => {
    setEditingCandidate(candidate);
    setNewDate(candidate.scheduledDate);
    setEditModalVisible(true);
  };

  // Save changed date
  const handleSaveChangedDate = async () => {
    if (!newDate) {
      notify.error('Please select a new date');
      return;
    }

    if (newDate.isSame(editingCandidate.scheduledDate, 'day')) {
      notify.error('Please select a different date');
      return;
    }

    setIsSavingDate(true);

    try {
      const payload = {
        vivaDate: newDate.toISOString(),
        forwardToDor: true,
        vivaDateAccepted: true,
        vivadateaccepted: 1,
        vivaDateAcceptedAt: new Date().toISOString()
      };

      const response = await API.patch(`/Viva/update-viva-date/${editingCandidate.sid}`, payload);

      if (response.status === 200) {
        notify.success(`Viva date changed for ${editingCandidate.candidateName}`);
        // Refresh data from API
        await fetchCandidates();

        setEditModalVisible(false);
        setEditingCandidate(null);
        setNewDate(null);
      }
    } catch (error) {
      console.error('Error changing date:', error);
      notify.error('Failed to change viva date');
    } finally {
      setIsSavingDate(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingCandidate(null);
    setNewDate(null);
  };

  // Get status tag
  const getStatusTag = (record) => {
    if (record.vivaDateAccepted === true) {
      return (
        <div className="flex flex-col items-center gap-1">
          <Tag color="green">✓ Accepted</Tag>
          {record.vivaDateAcceptedAt && (
            <span className="text-xs text-gray-500">
              {record.vivaDateAcceptedAt.format('DD-MM-YYYY HH:mm')}
            </span>
          )}
        </div>
      );
    }
    return <Tag color="blue">Pending Review</Tag>;
  };

  // Table columns
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      align: 'center',
    },
    {
      title: 'Candidate Details',
      key: 'candidateDetails',
      width: 280,
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.candidateName}</div>
          <div className="text-xs text-gray-500">{record.shodhanikId}</div>
          <div className="text-xs text-gray-500">{record.subject}</div>
          <div className="text-xs text-blue-600 mt-1">Supervisor: {record.supervisorName}</div>
        </div>
      ),
    },
    {
      title: 'Scheduled Date',
      key: 'scheduledDate',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center gap-1">
          <div className="font-medium text-gray-900">
            {record.scheduledDate?.format('DD-MM-YYYY')}
          </div>
          <div className="mt-1">
            {getStatusTag(record)}
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 220,
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col gap-2 items-center">
          {record.status === 'pending' && (

             canedit && (
              <>
                <Button
                  type="primary"
                  size="small"
                  icon={<Check size={14} />}
                  onClick={() => handleAcceptDate(record)}
                  loading={acceptingId === record.id}
                  className="bg-green-600 hover:bg-green-700 border-green-600 w-32"
                >
                  Accept Date
                </Button>
                <Button
                  type="default"
                  size="small"
                  icon={<Edit3 size={14} />}
                  onClick={() => handleOpenEditModal(record)}
                  className="w-32"
                >
                  Change Date
                </Button>
              </>
            )
             
            
          )}

          {record.status === 'accepted' && (
            <span className="text-green-600 text-sm font-medium">
              ✓ Date Confirmed
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar size={28} />
          Viva Date Management
        </h1>
        <p className="text-gray-600 mt-1">
          Review and manage viva dates forwarded by supervisors
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-8">
          <div className="text-center">
            <Spin size="large" />
            <p className="text-gray-600 mt-4">Loading candidates...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
          <Table
            columns={columns}
            dataSource={candidates}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} candidates`
            }}
            bordered
            size="middle"
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Scheduled Viva Dates
                  </h3>
                  <p className="text-gray-500">
                    No viva dates have been forwarded by supervisors yet.
                  </p>
                </div>
              )
            }}
          />

          {/* Summary Section */}
          {candidates.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-300">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div>
                  <span>Total Candidates: <span className="font-medium">{candidates.length}</span></span>
                  <span className="ml-4">
                    Accepted: <span className="font-medium text-green-600">
                      {candidates.filter(c => c.status === 'accepted').length}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-blue-600">
                    Pending Review: <span className="font-medium">
                      {candidates.filter(c => c.status === 'pending').length}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Date Modal */}
      <Modal
        title="Change Viva Date"
        open={editModalVisible}
        onOk={handleSaveChangedDate}
        onCancel={handleCancelEdit}
        confirmLoading={isSavingDate}
        okText="Save New Date"
        cancelText="Cancel"
      >
        {editingCandidate && (
          <div className="py-4">
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="font-medium text-gray-900">{editingCandidate.candidateName}</p>
              <p className="text-sm text-gray-600">{editingCandidate.shodhanikId}</p>
              <p className="text-sm text-gray-600 mt-1">{editingCandidate.subject}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Current Scheduled Date: <span className="font-medium">{editingCandidate.scheduledDate?.format('DD-MM-YYYY')}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select New Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={newDate}
                onChange={(date) => setNewDate(date)}
                format="DD-MM-YYYY"
                placeholder="Select New Date"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                className="w-full"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VivaDate;
