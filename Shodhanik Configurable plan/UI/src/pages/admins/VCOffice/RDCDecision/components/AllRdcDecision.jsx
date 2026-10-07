import { useEffect, useState } from 'react'
import { Table, Button, Space, Empty } from 'antd'
import { EditOutlined, EyeOutlined } from '@ant-design/icons'
import API from '../../../../../services/API'
import notification from '../../../../../services/NotificationService'

const AllRDCDecision = ({ 
  onSelectRow,
  canRead,
  canApprove,
  canReject,
  canRevise,
  canDownload 
}) => {
  const [subjects, setSubjects] = useState([])
  const [scholars, setScholars] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [scholarsLoading, setScholarsLoading] = useState(false)
  const notify = notification()

  useEffect(() => {
    fetchSubjects()
  }, [])

 const fetchSubjects = async () => {
    setSubjectsLoading(true)
    try {
      const response = await API.get(
        '/SynopsisRDC/GetDistinctSubjectsByWorkflowStep/6/10'
      )
      if (response.data && Array.isArray(response.data)) {
        setSubjects(response.data)
      }
    } catch (error) {
      // notify.error('Failed to fetch subjects')
      console.error(error)
    } finally {
      setSubjectsLoading(false)
    }
  }

 const fetchScholars = async (departmentID) => {
    setScholarsLoading(true)
    try {
      const response = await API.get(
        `/SynopsisRDC/GetScholarsByWorkflowStep/6/10/${departmentID}`
      )
      if (response.data && Array.isArray(response.data)) {
        setScholars(response.data)
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
    setSelectedSubject(record)
    fetchScholars(record.departmentID)
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
    // {
    //   title: 'Department ID',
    //   dataIndex: 'departmentID',
    //   key: 'departmentID',
    //   width: 120,
    // },
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
      render: (_, record) => (
        (canApprove || canReject || canRevise) ? (
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
        )
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
                ? 'bg-blue-100'
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

export default AllRDCDecision
