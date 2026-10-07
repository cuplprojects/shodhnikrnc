import { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import { hasPermission } from '@/services/hasPermissionService'

//tab imports
import AllRDCDecision from './components/AllRdcDecision'
import EditRDCDecision from './components/EditRdcDecision'

const RDCDecision = () => {
    // Permissions
    const canRead = hasPermission('rdc_proceedings.read')
    const canApprove = hasPermission('rdc_proceedings.approve')
    const canReject = hasPermission('rdc_proceedings.reject')
    const canRevise = hasPermission('rdc_proceedings.revise')
    const canDownload = hasPermission('rdc_proceedings.download')

    if (!canRead) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">You do not have permission to view this page.</p>
                </div>
            </div>
        )
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
            label: 'All RDC Proceedings',
            children: (
                <AllRDCDecision 
                    onSelectRow={handleSelectRow}
                    canRead={canRead}
                    canApprove={canApprove}
                    canReject={canReject}
                    canRevise={canRevise}
                    canDownload={canDownload}
                />
            ),
        },
        {
            key: '2',
            label: 'Edit RDC Proceedings',
            disabled: !selectedRecord,
            children: (
                <EditRDCDecision
                    selectedRecord={selectedRecord}
                    onBack={handleBackToList}
                    canRead={canRead}
                    canApprove={canApprove}
                    canReject={canReject}
                    canRevise={canRevise}
                    canDownload={canDownload}
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

export default RDCDecision
