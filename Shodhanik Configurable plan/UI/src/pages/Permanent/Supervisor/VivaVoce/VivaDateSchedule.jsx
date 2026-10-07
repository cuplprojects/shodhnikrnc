import { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Spin, Tag } from 'antd';
import { Calendar, Send } from 'lucide-react';
import dayjs from 'dayjs';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const VivaDateSchedule = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [forwardingId, setForwardingId] = useState(null);
  const notify = notification();

  // Fetch students from API
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await API.get('/Viva');
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map((item, index) => ({
          id: item.sid,
          sid: item.sid,
          srNo: index + 1,
          candidateName: item.name,
          shodhanikId: item.permUserName,
          subjectId: item.subject_ID,
          subject: item.subjectName,
          supervisorName: item.supervisorName,
          scheduledDate: item.vivaDate ? dayjs(item.vivaDate) : null,
          isDateSaved: !!item.vivaDate,
          isForwardedToDoR: item.forwardToDor || false,
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

  // Handle date change for a candidate
  const handleDateChange = (candidateId, date) => {
    setCandidates(prev =>
      prev.map(candidate =>
        candidate.id === candidateId
          ? { ...candidate, scheduledDate: date, isDateSaved: false }
          : candidate
      )
    );
  };

  // Save scheduled date for a candidate
  const handleSaveDate = async (candidate) => {
    if (!candidate.scheduledDate) {
      notify.error('Please select a date before saving');
      return;
    }

    setSavingId(candidate.id);
    
    try {
      const payload = {
        vivaDate: candidate.scheduledDate.toISOString(),
        forwardToDor: false
      };

      const response = await API.patch(`/Viva/update-viva-date/${candidate.sid}`, payload);
      
      if (response.status === 200) {
        notify.success(`Viva date saved for ${candidate.candidateName}`);
        // Refresh data from API
        await fetchCandidates();
      }
    } catch (error) {
      console.error('Error saving date:', error);
      notify.error('Failed to save viva date');
    } finally {
      setSavingId(null);
    }
  };

  // Forward to DoR
  const handleForwardToDoR = async (candidate) => {
    setForwardingId(candidate.id);
    
    try {
      const payload = {
        vivaDate: candidate.scheduledDate.toISOString(),
        forwardToDor: true
      };

      const response = await API.patch(`/Viva/update-viva-date/${candidate.sid}`, payload);
      
      if (response.status === 200) {
        notify.success(`Successfully forwarded ${candidate.candidateName} to DoR`);
        // Refresh data from API
        await fetchCandidates();
      }
    } catch (error) {
      console.error('Error forwarding to DoR:', error);
      notify.error('Failed to forward to DoR');
    } finally {
      setForwardingId(null);
    }
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
      title: 'Candidate Name',
      key: 'candidateName',
      width: 250,
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.candidateName}</div>
          <div className="text-xs text-gray-500">{record.shodhanikId}</div>
          <div className="text-xs text-gray-500">{record.subject}</div>
        </div>
      ),
    },
    {
      title: 'Supervisor',
      dataIndex: 'supervisorName',
      key: 'supervisorName',
      render: (text) => (
        <div className="text-sm text-gray-700">
          {text || 'N/A'}
        </div>
      ),
    },
    {
      title: 'Schedule Date',
      key: 'scheduleDate',
      width: 200,
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center gap-2">
          <DatePicker
            value={record.scheduledDate}
            onChange={(date) => handleDateChange(record.id, date)}
            format="DD-MM-YYYY"
            placeholder="Select Date"
            disabled={record.isForwardedToDoR}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            className="w-full"
          />
          {record.isDateSaved && !record.isForwardedToDoR && (
            <Tag color="green" className="text-xs">
              ✓ Date Saved
            </Tag>
          )}
          {record.isForwardedToDoR && (
            <Tag color="blue" className="text-xs">
              ✓ Forwarded to DoR
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 200,
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col gap-2 items-center">
          {!record.isDateSaved && !record.isForwardedToDoR && (
            <Button
              type="primary"
              size="small"
              icon={<Calendar size={14} />}
              onClick={() => handleSaveDate(record)}
              loading={savingId === record.id}
              disabled={!record.scheduledDate}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600"
            >
              Save Date
            </Button>
          )}
          
          {record.isDateSaved && !record.isForwardedToDoR && (
            <Button
              type="primary"
              size="small"
              icon={<Send size={14} />}
              onClick={() => handleForwardToDoR(record)}
              loading={forwardingId === record.id}
              className="bg-green-600 hover:bg-green-700 border-green-600"
            >
              Forward to DoR
            </Button>
          )}
          
          {record.isForwardedToDoR && (
            <span className="text-green-600 text-sm font-medium">
              ✓ Completed
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
          Viva Date Schedule
        </h1>
        <p className="text-gray-600 mt-1">
          Schedule viva dates for scholars whose thesis has been submitted
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
                    No Candidates Found
                  </h3>
                  <p className="text-gray-500">
                    No scholars with submitted thesis found for scheduling.
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
                    Scheduled: <span className="font-medium text-green-600">
                      {candidates.filter(c => c.isDateSaved).length}
                    </span>
                  </span>
                  <span className="ml-4">
                    Forwarded to DoR: <span className="font-medium text-blue-600">
                      {candidates.filter(c => c.isForwardedToDoR).length}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-amber-600">
                    Pending: <span className="font-medium">
                      {candidates.filter(c => !c.isDateSaved).length}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VivaDateSchedule;