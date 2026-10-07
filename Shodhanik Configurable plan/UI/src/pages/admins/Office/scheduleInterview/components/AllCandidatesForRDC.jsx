import { useEffect, useState } from 'react'
import { Table, Button, Space, Empty, DatePicker, Modal, Checkbox } from 'antd'
import { CalendarOutlined, SendOutlined } from '@ant-design/icons'
import { Mail, Phone, MapPin, Calendar, User } from 'lucide-react'
import dayjs from 'dayjs'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import {hasPermission} from '@/services/hasPermissionService';
import useStaffAuthStore from '@/store/staffAuthStore';

// Synopsis RDC Service Functions
const synopsisRDCService = {
  getDistinctSubjects: async () => {
    const response = await API.get('/SynopsisRDC/GetDistinctSubjectsForRDC')
    return response.data
  },
  
  getScholarsBySubject: async (departmentId) => {
    const response = await API.get(`/SynopsisRDC/GetScholarsForRDCBySubject/${departmentId}`)
    return response.data
  },
  
  assignRDCDate: async (subjectId, scholarId, rdcDate, actionByRoleId) => {
    const response = await API.post('/SynopsisRDC/AssignRDCDate', null, {
      params: { subjectId, scholarId, rdcDate, actionByRoleId }
    })
    return response.data
  },
  
  sendSynopsisEmail: async (memberEmails, scholarIds, department, actionByRoleId) => {
    const response = await API.post('/SynopsisRDC/SendSynopsisEmail', {
      memberEmails,
      scholarIds,
      department,
      actionByRoleId
    })
    return response.data
  }
}


const ADDITIONAL_RECIPIENTS = [
  { key: 'universityCampusHOD', label: 'University Campus (HOD)', roleName: 'University Campus (HOD)' },
  { key: 'universityDean', label: 'University Dean', roleName: 'University Dean' },
  { key: 'collegeConvenor', label: 'College Convenor', roleName: 'College Convenor' },
  { key: 'collegeDean', label: 'College Dean', roleName: 'College Dean' }
]

const AllCandidatesForInterview = ({ onViewScholar }) => {
  const [subjects, setSubjects] = useState([])
  const [scholars, setScholars] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [scholarsLoading, setScholarsLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [assigningDate, setAssigningDate] = useState(false)
  const [subjectForDateAssignment, setSubjectForDateAssignment] = useState(null)
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false)
  const [bulkSelectedDate, setBulkSelectedDate] = useState(null)
  const [assigningBulkDate, setAssigningBulkDate] = useState(false)
  const [rdcMembers, setRdcMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [sendingSynopsis, setSendingSynopsis] = useState(false)
  const [selectedScholars, setSelectedScholars] = useState([])
  const [selectedAdditionalRecipients, setSelectedAdditionalRecipients] = useState({
    universityCampusHOD: false,
    universityDean: false,
    collegeConvenor: false,
    collegeDean: false
  })
  const notify = notification()
  const [admin, setAdmin] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const canbulkupdate = hasPermission('schedule_rdc.bulk-assign')
  const canupdate = hasPermission('schedule_rdc.update')
  
  // Get logged-in user ID
  const { user } = useStaffAuthStore()

  useEffect(() => {
    fetchSubjects()
    fetchAdmin()
  }, [])

  const fetchSubjects = async () => {
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
  }

  const fetchAdmin = async () => {
    setAdminLoading(true)
    try {
      const response = await API.get('/admin/users')
      if (response.data && Array.isArray(response.data)) {
        setAdmin(response.data)
      }
    } catch (error) {
      notify.error('Failed to fetch admin users')
      console.error(error)
    } finally {
      setAdminLoading(false)
    }
  }

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

  const fetchRDCMembers = async (departmentID) => {
    setMembersLoading(true)
    try {
      const response = await API.get(`/Dor/${departmentID}`)
      if (response.data && Array.isArray(response.data)) {
        setRdcMembers(response.data)
        setSelectedMembers([])
      }
    } catch (error) {
      notify.error('Failed to fetch RDC members')
      console.error(error)
      setRdcMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  const handleSubjectClick = (record) => {
    // If clicking the same subject, toggle it (close if open)
    if (selectedSubject?.departmentID === record.departmentID) {
      setSelectedSubject(null)
      setScholars([])
      setRdcMembers([])
      setSelectedMembers([])
      setSelectedScholars([])
    } else {
      // Open new subject
      setSelectedSubject(record)
      fetchScholars(record.departmentID)
      fetchRDCMembers(record.departmentID)
      setSelectedScholars([])
    }
  }

  const handleScheduleInterview = (record) => {
    if (onViewScholar) {
      onViewScholar(record)
    }
  }

  const showDateModal = (record) => {
    setSubjectForDateAssignment(record)
    // Pre-populate with existing RDC date if available
    if (record.rdcDate) {
      const dateValue = record.rdcDate instanceof Date 
        ? dayjs(record.rdcDate)
        : dayjs(record.rdcDate)
      setSelectedDate(dateValue)
    } else {
      setSelectedDate(null)
    }
    setIsModalVisible(true)
  }

  const handleAssignRDCDate = async () => {
    if (!selectedDate || !subjectForDateAssignment) {
      notify.error('Please select a date')
      return
    }

    if (!user?.roleId) {
      notify.error('User role not found')
      return
    }

    setAssigningDate(true)
    try {
      const formattedDate = dayjs(selectedDate).format('DD-MM-YYYY')
      
      const result = await synopsisRDCService.assignRDCDate(
        selectedSubject.departmentID,
        subjectForDateAssignment.sid,
        formattedDate,
        user.roleId
      )
      
      if (result?.success) {
        notify.success(result.message || 'RDC date assigned successfully')
        setIsModalVisible(false)
        
        // Update the scholar's RDC date in the local state
        setScholars(prevScholars => 
          prevScholars.map(scholar => 
            scholar.sid === subjectForDateAssignment.sid 
              ? { ...scholar, rdcDate: selectedDate.toDate() }
              : scholar
          )
        )
        
        setSelectedDate(null)
        setSubjectForDateAssignment(null)
      } else {
        notify.error(result?.message || 'Failed to assign RDC date')
      }
    } catch (error) {
      notify.error('Failed to process RDC date')
      console.error(error)
    } finally {
      setAssigningDate(false)
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    setSelectedDate(null)
    setSubjectForDateAssignment(null)
  }

  const showBulkDateModal = () => {
    if (scholars.length === 0) {
      notify.error('No candidates available for bulk assignment')
      return
    }
    setBulkSelectedDate(null)
    setIsBulkModalVisible(true)
  }

  const handleBulkAssignRDCDate = async () => {
    if (!bulkSelectedDate || !selectedSubject) {
      notify.error('Please select a date')
      return
    }

    if (!user?.roleId) {
      notify.error('User role not found')
      return
    }

    setAssigningBulkDate(true)
    try {
      const formattedDate = dayjs(bulkSelectedDate).format('DD-MM-YYYY')
      
      // If no scholars selected, assign to all scholars
      const scholarsToAssign = selectedScholars.length > 0 ? selectedScholars : scholars.map(s => s.sid)
      
      // Use service function for all scholars
      const promises = scholarsToAssign.map(sid => 
        synopsisRDCService.assignRDCDate(
          selectedSubject.departmentID,
          sid,
          formattedDate,
          user.roleId
        )
      )
      
      await Promise.all(promises)
      
      notify.success(`RDC date assigned successfully to ${scholarsToAssign.length} candidate(s)`)
      
      // Update the scholars' RDC dates in the local state
      setScholars(prevScholars => 
        prevScholars.map(scholar => 
          scholarsToAssign.includes(scholar.sid)
            ? { ...scholar, rdcDate: bulkSelectedDate.toDate() }
            : scholar
        )
      )
      
      setIsBulkModalVisible(false)
      setBulkSelectedDate(null)
      setSelectedScholars([])
    } catch (error) {
      notify.error('Failed to assign RDC date')
      console.error(error)
    } finally {
      setAssigningBulkDate(false)
    }
  }

  const handleBulkModalCancel = () => {
    setIsBulkModalVisible(false)
    setBulkSelectedDate(null)
  }

  const handleMemberSelection = (memberId, checked) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId])
    } else {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId))
    }
  }

  const handleSelectAllMembers = (checked) => {
    if (checked) {
      setSelectedMembers(rdcMembers.map(member => member.id))
    } else {
      setSelectedMembers([])
    }
  }

  const handleSendSynopsis = async () => {
    if (selectedScholars.length === 0) {
      notify.error('Please select at least one candidate')
      return
    }

    if (selectedMembers.length === 0) {
      notify.error('Please select at least one nominated member')
      return
    }

    if (!Object.values(selectedAdditionalRecipients).some(v => v)) {
      notify.error('Please select at least one additional recipient')
      return
    }

    if (!user?.roleId) {
      notify.error('User role not found')
      return
    }

    try {
      setSendingSynopsis(true)
      
      const selectedMemberEmails = rdcMembers
        .filter(member => selectedMembers.includes(member.id))
        .map(member => member.email)

      const additionalRecipientEmails = ADDITIONAL_RECIPIENTS.reduce((acc, cfg) => {
        if (selectedAdditionalRecipients[cfg.key]) {
          const adminUser = admin.find(u => u.roleName === cfg.roleName)
          if (adminUser && adminUser.email) {
            acc.push(adminUser.email)
          }
        }
        return acc
      }, [])

      const memberEmails = Array.from(new Set([...selectedMemberEmails, ...additionalRecipientEmails]))

      await synopsisRDCService.sendSynopsisEmail(
        memberEmails,
        selectedScholars,
        selectedSubject?.subjectName || '',
        user.roleId
      )

      notify.success('Synopsis sent successfully')
      setSelectedMembers([])
      setSelectedAdditionalRecipients({
        universityCampusHOD: false,
        universityDean: false,
        collegeConvenor: false,
        collegeDean: false
      })
    } catch (error) {
      notify.error('Failed to send synopsis')
      console.error(error)
    } finally {
      setSendingSynopsis(false)
    }
  }

  const handleAdditionalRecipientToggle = (key, checked) => {
    setSelectedAdditionalRecipients(prev => ({
      ...prev,
      [key]: checked
    }))
  }

  const handleSelectAllAdditionalRecipients = (checked) => {
    if (checked) {
      setSelectedAdditionalRecipients({
        universityCampusHOD: true,
        universityDean: true,
        collegeConvenor: true,
        collegeDean: true
      })
    } else {
      setSelectedAdditionalRecipients({
        universityCampusHOD: false,
        universityDean: false,
        collegeConvenor: false,
        collegeDean: false
      })
    }
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
      title: (
        <Checkbox
          checked={selectedScholars.length === scholars.length && scholars.length > 0}
          indeterminate={selectedScholars.length > 0 && selectedScholars.length < scholars.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedScholars(scholars.map(s => s.sid))
            } else {
              setSelectedScholars([])
            }
          }}
        />
      ),
      key: 'checkbox',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedScholars.includes(record.sid)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedScholars([...selectedScholars, record.sid])
            } else {
              setSelectedScholars(selectedScholars.filter(id => id !== record.sid))
            }
          }}
        />
      ),
    },
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
      title: 'RDC Date',
      dataIndex: 'rdcDate',
      key: 'rdcDate',
      width: 120,
      render: (date) => {
        if (!date) {
          return <span className="text-gray-400 italic">Not assigned</span>
        }
        // Handle both Date objects and string formats
        const formattedDate = date instanceof Date 
          ? dayjs(date).format('DD-MM-YYYY')
          : dayjs(date).format('DD-MM-YYYY')
        return (
          <span className="text-blue-600 font-medium">
            {formattedDate}
          </span>
        )
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          {canupdate && (
            <Button
            type="primary"
            icon={<CalendarOutlined />}
            size="small"
            onClick={() => showDateModal(record)}
          >
            {record.rdcDate ? 'Update RDC' : 'Assign RDC'}
          </Button>
          )}
          
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {/* Page Heading */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Schedule RDC</h1>
        <p className="text-gray-600 text-xs mt-0.5">Research Degree Committee Interview Scheduling</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2.5">
        
        <Table
          columns={subjectColumns}
          dataSource={subjects}
          loading={subjectsLoading}
          rowKey="departmentID"
          pagination={{
            pageSize: 5,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} subjects`,
            size: 'small'
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
          size="small"
        />
      </div>

      {selectedSubject && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2.5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-gray-700">
                Candidates - {selectedSubject.subjectName}
                {selectedScholars.length > 0 && (
                  <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {selectedScholars.length} selected
                  </span>
                )}
              </h3>
              {scholars.length > 0 &&  canbulkupdate &&(
                <Button
                  type="primary"
                  icon={<CalendarOutlined />}
                  onClick={showBulkDateModal}
                  size="small"
                >
                  Bulk Assign {selectedScholars.length > 0 ? `(${selectedScholars.length})` : '(All)'}
                </Button>
              )}
            </div>
            {scholars.length === 0 && !scholarsLoading ? (
              <Empty description="No candidates found for this subject" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                columns={scholarColumns}
                dataSource={scholars}
                loading={scholarsLoading}
                rowKey="sid"
                pagination={{
                  pageSize: 5,
                  showSizeChanger: false,
                  showTotal: (total) => `Total ${total} candidates`,
                  size: 'small'
                }}
                scroll={{ x: 1200 }}
                size="small"
              />
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-2 border-b border-gray-200 rounded-t-lg">
              <div>
                <h3 className="text-xs font-semibold text-gray-700">
                  RDC Committee Members
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {selectedSubject.subjectName}
                </p>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-2.5">
              {membersLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-xs text-gray-600">Loading members...</p>
                </div>
              ) : rdcMembers.length === 0 ? (
                <Empty description="No RDC members found for this subject" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="space-y-3">
                  {/* Nominated Members Section */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200">
                    <div className="bg-white px-2.5 py-1.5 border-b border-gray-200 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <Checkbox
                          checked={selectedMembers.length === rdcMembers.length}
                          indeterminate={selectedMembers.length > 0 && selectedMembers.length < rdcMembers.length}
                          onChange={(e) => handleSelectAllMembers(e.target.checked)}
                        >
                          <span className="text-[14px] font-bold text-gray-700">
                            Nominated Members
                          </span>
                        </Checkbox>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {selectedMembers.length} of {rdcMembers.length}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {rdcMembers.map((member) => (
                          <div
                            key={member.id}
                            className="bg-white rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md"
                          >
                            <div className="p-2.5">
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={selectedMembers.includes(member.id)}
                                  onChange={(e) => handleMemberSelection(member.id, e.target.checked)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-[14px] text-gray-900 mb-1.5">
                                    {member.name}
                                  </h4>
                                  
                                  <div className="space-y-1">
                                    <div className="flex items-start gap-1.5">
                                      <Mail className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-xs text-gray-700 break-all leading-tight">{member.email}</p>
                                    </div>
                                    
                                    <div className="flex items-start gap-1.5">
                                      <Phone className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-xs text-gray-700 leading-tight">{member.contactNo}</p>
                                    </div>
                                    
                                    <div className="flex items-start gap-1.5">
                                      <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-xs text-gray-700 line-clamp-1 leading-tight">
                                        {member.address}
                                      </p>
                                    </div>
                                    
                                    <div className="flex items-start gap-1.5">
                                      <Calendar className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-xs text-blue-600 font-medium leading-tight">
                                        {member.from ? dayjs(member.from).format('DD/MM/YYYY') : ''} - {member.to ? dayjs(member.to).format('DD/MM/YYYY') : ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional Recipients Section */}
                  {admin.length > 0 && (
                    <div className="bg-gray-50 rounded-lg border border-gray-200">
                      <div className="bg-white px-2.5 py-1.5 border-b border-gray-200 rounded-t-lg">
                        <Checkbox
                          checked={
                            Object.values(selectedAdditionalRecipients).every(v => v) &&
                            Object.values(selectedAdditionalRecipients).some(v => v)
                          }
                          indeterminate={
                            Object.values(selectedAdditionalRecipients).some(v => v) &&
                            !Object.values(selectedAdditionalRecipients).every(v => v)
                          }
                          onChange={(e) => handleSelectAllAdditionalRecipients(e.target.checked)}
                        >
                          <span className="text-[14px] font-bold text-gray-700">
                            Additional Recipients
                          </span>
                        </Checkbox>
                      </div>
                      
                      <div className="p-2.5">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                          {ADDITIONAL_RECIPIENTS.map((cfg) => {
                            const user = admin.find(u => u.roleName === cfg.roleName)
                            if (!user) {
                              return null
                            }
                            return (
                              <div
                                key={cfg.key}
                                className="bg-white rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md"
                              >
                                <div className="p-2.5">
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      checked={selectedAdditionalRecipients[cfg.key]}
                                      onChange={(e) => handleAdditionalRecipientToggle(cfg.key, e.target.checked)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-[14px] text-gray-900 mb-0.5">
                                        {cfg.label}
                                      </h4>
                                      <p className="text-xs text-gray-700 leading-tight mb-1">
                                        {user.name}
                                      </p>
                                      <div className="flex items-start gap-1.5">
                                        <Mail className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-gray-700 break-all leading-tight">
                                          {user.email}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Send Synopsis Button - Bottom Center */}
            {!membersLoading && rdcMembers.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50 px-2.5 py-2 rounded-b-lg">
                <div className="flex justify-center">
                  {canupdate && (
                     <Button
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleSendSynopsis}
                    loading={sendingSynopsis}
                    disabled={
                      selectedScholars.length === 0 ||
                      selectedMembers.length === 0 ||
                      !Object.values(selectedAdditionalRecipients).some(v => v)
                    }
                    className="shadow-lg min-w-[200px] !bg-green-500 !border-green-500 !text-white !font-semibold !text-base"
                  >
                    Send Synopsis
                  </Button>
                  )}
                 
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        title={
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-blue-600" />
            <span>{subjectForDateAssignment?.rdcDate ? 'Update RDC Date' : 'Assign RDC Date'}</span>
          </div>
        }
        open={isModalVisible}
        onOk={handleAssignRDCDate}
        onCancel={handleModalCancel}
        confirmLoading={assigningDate}
        okText={subjectForDateAssignment?.rdcDate ? 'Update Date' : 'Assign Date'}
      >
        <div className="space-y-4">
          <p className="font-medium">
            Candidate: {subjectForDateAssignment?.name}
          </p>
          <p className="text-sm text-gray-600">
            Application No: {subjectForDateAssignment?.applicationNo}
          </p>
          {subjectForDateAssignment?.rdcDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Current RDC Date:</strong> {
                  subjectForDateAssignment.rdcDate instanceof Date
                    ? dayjs(subjectForDateAssignment.rdcDate).format('DD-MM-YYYY')
                    : dayjs(subjectForDateAssignment.rdcDate).format('DD-MM-YYYY')
                }
              </p>
            </div>
          )}
          <div>
            <label className="block mb-2">Select RDC Date:</label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              format="DD-MM-YYYY"
              className="w-full"
              placeholder="Select date"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Bulk Assign RDC Date</span>
          </div>
        }
        open={isBulkModalVisible}
        onOk={handleBulkAssignRDCDate}
        onCancel={handleBulkModalCancel}
        confirmLoading={assigningBulkDate}
        okText="Assign Date to All"
        width={600}
      >
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-full p-2">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">
                  Subject: {selectedSubject?.subjectName}
                </h4>
                <p className="text-sm text-gray-600">
                  This will assign the selected RDC date to {selectedScholars.length > 0 ? (
                    <span className="font-semibold text-blue-600">{selectedScholars.length} selected candidate(s)</span>
                  ) : (
                    <span className="font-semibold text-blue-600">all {scholars.length} candidate(s)</span>
                  )}.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select RDC Date:
            </label>
            <DatePicker
              value={bulkSelectedDate}
              onChange={setBulkSelectedDate}
              format="DD-MM-YYYY"
              className="w-full"
              placeholder="Select date for selected candidates"
              size="large"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> {selectedScholars.length > 0 ? `The selected ${selectedScholars.length} candidate(s)` : `All ${scholars.length} candidates`} will be assigned the same RDC date. You can still modify individual dates later if needed.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AllCandidatesForInterview
