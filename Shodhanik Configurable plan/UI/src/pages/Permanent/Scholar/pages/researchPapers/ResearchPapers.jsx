import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import AddNewResearchPaper from './components/AddNewResearchPaper';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useFileViewer } from '@/services/FileViewerService';

const ResearchPapers = () => {
  const [papersData, setPapersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const { getSId } = useSelectedScholarAuthStore();
  const notify = notification();
  const baseFileURL = getBaseFileURL();
  const fileViewer = useFileViewer();

  useEffect(() => {
    const fetchPapersData = async () => {
      try {
        setLoading(true);
        const sId = getSId();
        
        if (!sId) {
          setError('Scholar ID not found');
          return;
        }

        try {
          // Fetch research papers from API
          const response = await API.get(`/ScholarResearch/${sId}`);
          if (response.data && Array.isArray(response.data)) {
            // Map API data to table format with detailed information
            const mappedData = response.data.map((paper, index) => ({
              key: paper.id || index + 1,
              srNo: index + 1,
              id: paper.id,
              titleOfPaper: paper.titleOfPaper || 'N/A',
              authorNames: paper.authorNames || [],
              authorName: paper.authorName || [], // Keep original API field for editing
              nameOfJournal: paper.nameOfJournal || 'N/A',
              yearOfPb: paper.yearOfPb || 'N/A',
              volume: paper.volume || 'N/A',
              issNo: paper.issNo || 'N/A',
              page: paper.page || 'N/A',
              citations: paper.citations || 'N/A',
              impactFactor: paper.impactFactor || 'N/A',
              webUrl: paper.webUrl || null,
              listedIn: paper.listedIn || 'N/A',
              ugcListNo: paper.ugcListNo || 'N/A',
              uploadPaper: paper.uploadPaper || null,
              supervisorStatus: paper.status || 'Pending'
            }));
            console.log(mappedData)
            setPapersData(mappedData);
          } else {
            setPapersData([]);
          }
        } catch (err) {
          console.error('Error fetching papers data:', err);
          setPapersData([]);
        }
      } catch (err) {
        console.error('Error fetching papers data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPapersData();
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
        // Update existing paper with PATCH
        response = await API.patch(`/ScholarResearch/${editingRecord.id}`, formData);
      } else {
        // Create new paper with POST
        response = await API.post('/ScholarResearch', formData);
      }

      if (response.data) {
        notify.success(editingRecord ? 'Research paper updated successfully' : 'Research paper added successfully');
        setModalVisible(false);
        setEditingRecord(null);
        
        // Refresh the data
        const sId = getSId();
        if (sId) {
          try {
            const refreshResponse = await API.get(`/ScholarResearch/${sId}`);
            if (refreshResponse.data && Array.isArray(refreshResponse.data)) {
              const mappedData = refreshResponse.data.map((paper, index) => ({
                key: paper.id || index + 1,
                srNo: index + 1,
                id: paper.id,
                titleOfPaper: paper.titleOfPaper || 'N/A',
                authorNames: paper.authorNames || [],
                authorName: paper.authorName || [], // Keep original API field for editing
                nameOfJournal: paper.nameOfJournal || 'N/A',
                yearOfPb: paper.yearOfPb || 'N/A',
                volume: paper.volume || 'N/A',
                issNo: paper.issNo || 'N/A',
                page: paper.page || 'N/A',
                citations: paper.citations || 'N/A',
                impactFactor: paper.impactFactor || 'N/A',
                webUrl: paper.webUrl || null,
                listedIn: paper.listedIn || 'N/A',
                ugcListNo: paper.ugcListNo || 'N/A',
                uploadPaper: paper.uploadPaper || null,
                supervisorStatus: paper.status || 'Pending'
              }));
              setPapersData(mappedData);
              console.log(mappedData)
            }
          } catch (refreshErr) {
            console.error('Error refreshing data:', refreshErr);
          }
        }
      }
    } catch (err) {
      console.error('Error submitting paper data:', err);
      notify.error(editingRecord ? 'Failed to update research paper' : 'Failed to add research paper');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleViewPaper = (record) => {
    if (record.uploadPaper) {
      const fileUrl = `${baseFileURL}/${record.uploadPaper}`;
      fileViewer.openFile(fileUrl, record.titleOfPaper || 'Research Paper');
    } else {
      notify.info('No paper file available');
    }
  };

  const handleViewWebsite = (record) => {
    if (record.webUrl) {
      window.open(record.webUrl, '_blank');
    } else {
      notify.info('No website URL available');
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
          <div><span className="font-semibold">Year of Publication:</span> {record.yearOfPb}</div>
          <div><span className="font-semibold">Name of Journal:</span> {record.nameOfJournal}</div>
          <div><span className="font-semibold">Author(s):</span> {record.authorNames.join(', ')}</div>
          <div><span className="font-semibold">ISSN No.:</span> {record.issNo} <span className="font-semibold">Volume:</span> {record.volume} <span className="font-semibold">Page No.:</span> {record.page}</div>
          <div><span className="font-semibold">Citations:</span> {record.citations} <span className="font-semibold">Impact Factor:</span> {record.impactFactor}</div>
          <div><span className="font-semibold">Listed in:</span> {record.listedIn} <span className="font-semibold">UGC List No.:</span> {record.ugcListNo}</div>
          <div className="flex gap-2 mt-2">
            {record.webUrl && (
              <Button
                type="link"
                size="small"
                onClick={() => handleViewWebsite(record)}
                className="p-0 h-auto text-blue-600"
              >
                Web Link
              </Button>
            )}
            {record.uploadPaper && (
              <Button
                type="link"
                size="small"
                onClick={() => handleViewPaper(record)}
                className="p-0 h-auto text-blue-600"
              >
                Attachment
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
        // Only show edit button if supervisor status is not accepted (status !== 1)
        record.supervisorStatus !== 1 ? (
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
            Research Papers
          </h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddNew}
            size="small"
            className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
          >
            Add New Paper
          </Button>
        </div>

        {/* Research Papers Table */}
        <Card className="shadow-sm" style={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={papersData}
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
            className="research-papers-table"
            scroll={{ x: 800 }}
          />
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <AddNewResearchPaper
        visible={modalVisible}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        loading={submitting}
        editingRecord={editingRecord}
      />

      {/* File Viewer Modal */}
      {fileViewer.FileViewerModal}

      <style jsx global>{`
        .research-papers-table .ant-table-thead > tr > th {
          font-weight: 600;
          color: #334155;
          border-bottom: 1px solid #cbd5e1;
        }
        
        .research-papers-table .ant-table-tbody > tr:hover > td {
          background-color: #f8fafc !important;
        }
        
        .research-papers-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 12px;
        }
        
        .research-papers-table .ant-empty-description {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default ResearchPapers;