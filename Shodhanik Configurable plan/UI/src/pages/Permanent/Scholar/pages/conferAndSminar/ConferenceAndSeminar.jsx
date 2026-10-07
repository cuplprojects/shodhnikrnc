import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import AddNewConferAndSem from './components/AddNewConferAndSem';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const ConferenceAndSeminar = () => {
  const [conferenceData, setConferenceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const { getSId } = useSelectedScholarAuthStore();
  const notify = notification();
  const baseFileURL = getBaseFileURL();

  useEffect(() => {
    const fetchConferenceData = async () => {
      try {
        setLoading(true);
        const sId = getSId();
        
        if (!sId) {
          setLoading(false);
          return;
        }

        try {
          // Fetch conference data from API
          const response = await API.get(`/ScholarConferences/${sId}`);
          if (response.data && Array.isArray(response.data)) {
            // Map API data to table format with detailed information
            const mappedData = response.data.map((conference, index) => ({
              key: conference.id || index + 1,
              srNo: index + 1,
              id: conference.id,
              titleOfPaper: conference.titleOfPaper || 'N/A',
              authorName: conference.authorName || 'N/A', 
              nameOfConference: conference.nameOfConference || 'N/A',
              levelOfConference: conference.levelOfConference || 'N/A',
              organizedBy: conference.organizedBy || 'N/A',
              place: conference.place || 'N/A',
              sponsoringAgency: conference.sponsoringAgency || 'N/A',
              startingDate: conference.startingDate ? new Date(conference.startingDate).toLocaleDateString() : 'N/A',
              endingDate: conference.endingDate ? new Date(conference.endingDate).toLocaleDateString() : 'N/A',
              startingDateRaw: conference.startingDate, // Keep raw date for editing
              endingDateRaw: conference.endingDate, // Keep raw date for editing
              presentationCertificate: conference.presentationCertificate || null,
              supervisorStatus: conference.conferenceStatus || 'Pending'
            }));
            console.log(mappedData)
            setConferenceData(mappedData);
          } else {
            setConferenceData([]);
          }
        } catch (err) {
          console.error('Error fetching conference data:', err);
          setConferenceData([]);
        }
      } catch (err) {
        console.error('Error fetching conference data:', err);
        setConferenceData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConferenceData();
  }, [getSId]);

  const handleAddNew = () => {
    setEditingRecord(null);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingRecord(null);
  };

  const handleModalSubmit = async (formData) => {
    try {
      setSubmitting(true);

      let response;
      if (editingRecord) {
        // Update existing conference with PATCH
        response = await API.patch(`/ScholarConferences/${editingRecord.id}`, formData);
      } else {
        // Create new conference with POST
        response = await API.post('/ScholarConferences', formData);
      }

      if (response.data) {
        notify.success(editingRecord ? 'Conference/Seminar updated successfully' : 'Conference/Seminar added successfully');
        setModalVisible(false);
        setEditingRecord(null);
        
        // Refresh the data
        const sId = getSId();
        if (sId) {
          try {
            const refreshResponse = await API.get(`/ScholarConferences/${sId}`);
            if (refreshResponse.data && Array.isArray(refreshResponse.data)) {
              const mappedData = refreshResponse.data.map((conference, index) => ({
                key: conference.id || index + 1,
                srNo: index + 1,
                id: conference.id,
                titleOfPaper: conference.titleOfPaper || 'N/A',
                authorName: conference.authorName || 'N/A', 
                nameOfConference: conference.nameOfConference || 'N/A',
                levelOfConference: conference.levelOfConference || 'N/A',
                organizedBy: conference.organizedBy || 'N/A',
                place: conference.place || 'N/A',
                sponsoringAgency: conference.sponsoringAgency || 'N/A',
                startingDate: conference.startingDate ? new Date(conference.startingDate).toLocaleDateString() : 'N/A',
                endingDate: conference.endingDate ? new Date(conference.endingDate).toLocaleDateString() : 'N/A',
                startingDateRaw: conference.startingDate, // Keep raw date for editing
                endingDateRaw: conference.endingDate, // Keep raw date for editing
                presentationCertificate: conference.presentationCertificate || null,
                supervisorStatus: conference.conferenceStatus || 'Pending'
              }));
              setConferenceData(mappedData);
            }
          } catch (refreshErr) {
            console.error('Error refreshing data:', refreshErr);
          }
        }
      }
    } catch (err) {
      console.error('Error submitting conference data:', err);
      notify.error(editingRecord ? 'Failed to update conference/seminar' : 'Failed to add conference/seminar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleDelete = (record) => {
    console.log('Delete conference/seminar:', record);
    // TODO: Implement delete functionality
  };

  const handleViewCertificate = (record) => {
    if (record.presentationCertificate) {
      const fileUrl = `${baseFileURL}/${record.presentationCertificate}`;
      window.open(fileUrl, '_blank');
    } else {
      notify.info('No certificate available');
    }
  };

  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      align: 'center',
    },
    {
      title: 'Title of Paper',
      dataIndex: 'titleOfPaper',
      key: 'titleOfPaper',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Details',
      key: 'details',
      width: 400,
      render: (_, record) => (
        <div className="text-xs space-y-1">
          <div><span className="font-semibold">Conference:</span> {record.nameOfConference}</div>
          <div><span className="font-semibold">Level:</span> {record.levelOfConference}</div>
          <div><span className="font-semibold">Author(s):</span> {record.authorName}</div>
          <div><span className="font-semibold">Date:</span> {record.startingDate} to {record.endingDate}</div>
          <div><span className="font-semibold">Place:</span> {record.place}</div>
          <div><span className="font-semibold">Organized By:</span> {record.organizedBy}</div>
          {record.sponsoringAgency && record.sponsoringAgency !== 'N/A' && (
            <div><span className="font-semibold">Sponsoring Agency:</span> {record.sponsoringAgency}</div>
          )}
          <div className="flex gap-2 mt-2">
            {record.presentationCertificate && (
              <Button
                type="link"
                size="small"
                onClick={() => handleViewCertificate(record)}
                className="p-0 h-auto text-blue-600"
              >
                Certificate
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Supervisor Status',
      dataIndex: 'supervisorStatus',
      key: 'supervisorStatus',
      width: 150,
      align: 'center',
      render: (status) => (
        <Tag color={status === 1 ? 'green' : status === 2 ? 'red' : 'orange'}>
          {status === 1 ? "Accepted" : status === 2 ? "Rejected" : "Pending"}
        </Tag>
      ),
    },
    {
      title: 'Edit',
      key: 'edit',
      width: 80,
      align: 'center',
      render: (_, record) => (
        record.supervisorStatus != 1 ? (
          <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
          size="small"
          title="Edit"
        />
        ) : (
            <span className="text-gray-400 text-xs">Locked</span>
        )
        
      ),
    },
    // {
    //   title: 'Delete',
    //   key: 'delete',
    //   width: 80,
    //   align: 'center',
    //   render: (_, record) => (
    //     <Button
    //       type="link"
    //       danger
    //       icon={<DeleteOutlined />}
    //       onClick={() => handleDelete(record)}
    //       size="small"
    //       title="Delete"
    //     />
    //   ),
    // },
  ];

  return (
    <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2 flex justify-between items-center">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Conference / Seminars
          </h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddNew}
            size="small"
            className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
          >
            Add New Conference/Seminar
          </Button>
        </div>

        {/* Conference and Seminar Table */}
        <Card className="shadow-sm" style={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={conferenceData}
            loading={loading}
            pagination={false}
            size="small"
            locale={{
              emptyText: (
                <div className="py-8 text-center text-gray-500">
                  <div className="text-lg font-medium">0 Papers Found</div>
                </div>
              ),
            }}
            className="conference-seminar-table"
            scroll={{ x: 800 }}
          />
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <AddNewConferAndSem
        visible={modalVisible}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        loading={submitting}
        editingRecord={editingRecord}
      />

      <style jsx global>{`
        .conference-seminar-table .ant-table-thead > tr > th {
          background-color: #f1f5f9;
          font-weight: 600;
          color: #334155;
          border-bottom: 1px solid #cbd5e1;
        }
        
        .conference-seminar-table .ant-table-tbody > tr:hover > td {
          background-color: #f8fafc !important;
        }
        
        .conference-seminar-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 12px;
        }
        
        .conference-seminar-table .ant-empty-description {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default ConferenceAndSeminar;