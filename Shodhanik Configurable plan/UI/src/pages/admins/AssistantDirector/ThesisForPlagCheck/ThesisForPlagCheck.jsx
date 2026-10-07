import { useState } from 'react'
import { Tabs } from 'antd'
//tab imports
import AllPlagCheck from './components/AllPlagCheck'
import EditPlagCheck from './components/EditPlagCheck'
import { hasPermission } from '@/services/hasPermissionService';
const ThesisForPlagCheck = () => {
  //permissions
  const canRead = hasPermission('thesis_for_plag_check.read')
  const canCreate = hasPermission('thesis_for_plag_check.create')
  const canUpdate = hasPermission('thesis_for_plag_check.update')
  const canDelete = hasPermission('thesis_for_plag_check.delete')
  const canApprove = hasPermission('thesis_for_plag_check.approve')
  const canReject = hasPermission('thesis_for_plag_check.reject')
  const canDownload = hasPermission('thesis_for_plag_check.download');
  const canUpload = hasPermission('thesis_for_plag_check.upload');
  const canMarkPending = hasPermission('thesis_for_plag_check.pending')
  if (!canRead) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState('1')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const handleSelectRow = (record) => {
    setSelectedRecord(record)
    setActiveTab('2')
  }
  const handleBackToList = () => {
    setSelectedRecord(null)
    setActiveTab('1')
  }
  const items = [
    {
      key: '1',
      label: 'All Plagiarism Checks',
      children: <AllPlagCheck
        canRead={canRead}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canApprove={canApprove}
        canReject={canReject}
        canDownload={canDownload}
        canUpload={canUpload}
        onSelectRow={handleSelectRow} />,
    },
    {
      key: '2',
      label: 'Edit Plagiarism Check',
      disabled: !selectedRecord,
      children: (
        <EditPlagCheck
          canRead={canRead}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canApprove={canApprove}
          canReject={canReject}
          canDownload={canDownload}
          canUpload={canUpload}
          selectedRecord={selectedRecord}
          onBack={handleBackToList}
          canMarkPending={canMarkPending}
        />
      ),
    },
  ]
  return (
    <div style={{ padding: '20px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  )
}
export default ThesisForPlagCheck