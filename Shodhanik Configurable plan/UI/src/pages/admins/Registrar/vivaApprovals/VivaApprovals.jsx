import { useState } from 'react'
import { Tabs } from 'antd'
//tab imports
import AllVivaApprovals from './components/AllVivaApprovals'
import EditVivaapprovals from './components/EditVivaapprovals'
import { hasPermission } from '@/services/hasPermissionService';
const VivalApprovals = () => {
    //permissions
    const canRead = hasPermission('registrar_viva_approval.read')
    const canCreate = hasPermission('registrar_viva_approval.create')
    const canUpdate = hasPermission('registrar_viva_approval.update')
    const canDelete = hasPermission('registrar_viva_approval.delete')
    const canApprove = hasPermission('registrar_viva_approval.approve')
    const canReject = hasPermission('registrar_viva_approval.reject')
    if (!canRead) {
        return;
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
            label: 'All Viva Approvals',
            children: <AllVivaApprovals onSelectRow={handleSelectRow} />,
        },
        {
            key: '2',
            label: 'Edit Viva Approvals',
            disabled: !selectedRecord,
            children: (
                <EditVivaapprovals
                    canApprove={canApprove}
                    canReject={canReject}
                    selectedRecord={selectedRecord}
                    onBack={handleBackToList}
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
export default VivalApprovals