import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Empty } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'

// Synopsis RDC Service Functions for Workflow Step 6
const synopsisRDCService = {
  getDistinctSubjects: async () => {
    const response = await API.get(
      '/SynopsisRDC/GetDistinctSubjectsByWorkflowStep/6/6'
    )
    return response.data
  },

  getScholarsBySubject: async (departmentId) => {
    const response = await API.get(
      `/SynopsisRDC/GetScholarsByWorkflowStep/6/6/${departmentId}`
    )
    return response.data
  },
}

const AllRDCProceedings = ({
  onSelectRow,
  canRead,
  canApprove,
  canReject,
  canRevise,
}) => {
  const [subjects, setSubjects] = useState([])
  const [scholars, setScholars] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [scholarsLoading, setScholarsLoading] = useState(false)
  const notify = useMemo(() => notification(), [])

  const fetchSubjects = useCallback(async () => {
    setSubjectsLoading(true)
    try {
      const data = await synopsisRDCService.getDistinctSubjects()
      if (data && Array.isArray(data)) {
        setSubjects(data)
      }
    } catch (error) {
      notify.error('Failed to fetch subjects')
      console.error(error)
    } finally {
      setSubjectsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])

  const fetchScholars = async (departmentID) => {
    setScholarsLoading(true)
    try {
      const data = await synopsisRDCService.getScholarsBySubject(departmentID)
      if (data && Array.isArray(data)) {
        setScholars(data)
      }
    } catch (error) {
      notify.error('Failed to fetch scholars')
      console.error(error)
      setScholars([])
    } finally {
      setScholarsLoading(false)
    }
  }

  const handleSubjectClick = (record) => {
    if (selectedSubject?.departmentID === record.departmentID) {
      setSelectedSubject(null)
      setScholars([])
    } else {
      setSelectedSubject(record)
      fetchScholars(record.departmentID)
    }
  }

  const handleEditProceeding = (record) => {
    onSelectRow(record)
  }

  const subjectColumns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Subject Name',
      dataIndex: 'subjectName',
      key: 'subjectName',
      sorter: (a, b) => a.subjectName.localeCompare(b.subjectName),
    },
  ]

  const scholarColumns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Application No',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      sorter: (a, b) => a.applicationNo.localeCompare(b.applicationNo),
    },
    {
      title: 'Supervisor Name',
      dataIndex: 'supervisorName',
      key: 'supervisorName',
    },
    {
      title: 'Supervisor Email',
      dataIndex: 'supervisorEmail',
      key: 'supervisorEmail',
    },
    {
      title: 'Supervisor Mobile',
      dataIndex: 'supervisorMobile',
      key: 'supervisorMobile',
      width: 130,
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, record) =>
        canApprove || canReject || canRevise ? (
          <Space>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleEditProceeding(record)}
            >
              View
            </Button>
          </Space>
        ) : (
          <span className="text-red-500 text-xs">Permission Denied</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Subject</h3>
        <Table
          columns={subjectColumns}
          dataSource={subjects}
          loading={subjectsLoading}
          rowKey="departmentID"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} subjects`,
          }}
          onRow={(record) => ({
            onClick: () => handleSubjectClick(record),
            style: { cursor: 'pointer' },
            className:
              selectedSubject?.departmentID === record.departmentID
                ? 'bg-blue-50'
                : '',
          })}
          scroll={{ x: 600 }}
        />
      </div>

      {selectedSubject && (
        <div>
          <h3 className="text-lg font-semibold mb-2">
            RDC Proceedings - {selectedSubject.subjectName}
          </h3>
          {scholars.length === 0 && !scholarsLoading ? (
            <Empty description="No RDC proceedings found for this subject" />
          ) : (
            <Table
              columns={scholarColumns}
              dataSource={scholars}
              loading={scholarsLoading}
              rowKey="sid"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} proceedings`,
              }}
              scroll={{ x: 1200 }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default AllRDCProceedings
