import { useState } from 'react'
import { Tabs } from 'antd'

//tab imports
import AllVivaApprovals from './components/AllVivaApprovals'
import EditVivaapprovals1 from './components/EditVivaApprovals1'
import EditVivaapprovals2 from './components/EditVivaApprovals2'
import { hasPermission } from '@/services/hasPermissionService';
const VivalApprovals = () => {
    //permissions
    const canRead1 = hasPermission('aa_viva_approval_1.read')
    const canRead2 = hasPermission('aa_viva_approval_2.read')
    const canApprove1 = hasPermission('aa_viva_approval_1.approve')
    const canApprove2 = hasPermission('aa_viva_approval_2.approve')
    const canReject1 = hasPermission('aa_viva_approval_1.reject')
    const canReject2 = hasPermission('aa_viva_approval_2.reject')
    // if (!canRead1 || !canRead2) {
    //     return (
    //         <div className="p-6">
    //             <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    //                 <p className="text-red-600">You do not have permission to view this page.</p>
    //             </div>
    //         </div>
    //     );
    // }
    // Hardcoded role - change this to 'isAd1', 'isAd2', or 'admin'
    // const role = 'admin';
    const role = canRead1 ? 'isAd1' : canRead2 ? 'isAd2' : 'admin';
    //const role = 'isAd2';

    const [activeTab, setActiveTab] = useState('1')
    const [selectedRecord, setSelectedRecord] = useState(null)

    const handleSelectRow = (record, tabType = null) => {
        setSelectedRecord(record)

        // Route to appropriate tab based on role and tabType
        if (role === 'admin') {
            // If admin, route to the selected tab (tab1 or tab2)
            setActiveTab(tabType === 'tab2' ? '3' : '2')
        } else if (role === 'isAd1') {
            setActiveTab('2')
        } else if (role === 'isAd2') {
            setActiveTab('3')
        }
    }
    const handleBackToList = () => {
        setSelectedRecord(null)
        setActiveTab('1')
    }

    // Determine tab labels based on role
    const getTabLabel = (tabNum) => {
        // if (role === 'admin') {
        //     return tabNum === 1 ? 'Assistant Director 1' : 'Assistant Director 2'
        // }
        return tabNum === 1 ? 'Edit Viva Approvals' : 'Edit Viva Approvals'
    }

    const items = [
        {
            key: '1',
            label: 'All Viva Approvals',
            children: <AllVivaApprovals
                canRead={canRead1 || canRead2}
                canApprove={canApprove1 || canApprove1}
                canReject={canReject1 || canReject2}
                onSelectRow={handleSelectRow}
                role={role} />,
        },
        {
            key: '2',
            label: getTabLabel(1),
            disabled: !selectedRecord,
            children: (
                <EditVivaapprovals1
                    canRead={canRead1}
                    canApprove={canApprove1}
                    canReject={canReject1}
                    selectedRecord={selectedRecord}
                    onBack={handleBackToList}
                />
            ),
        },
        {
            key: '3',
            label: getTabLabel(2),
            disabled: !selectedRecord,
            children: (
                <EditVivaapprovals2
                    canRead={canRead2}
                    canApprove={canApprove2}
                    canReject={canReject2}
                    selectedRecord={selectedRecord}
                    onBack={handleBackToList}
                />
            ),
        },
    ]

    // If role is not admin, hide the unused tab
    if (role === 'isAd1') {
        return (
            <div style={{ padding: '20px' }}>
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={items.slice(0, 2)} />
            </div>
        )
    }

    if (role === 'isAd2') {
        return (
            <div style={{ padding: '20px' }}>
                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key === '1' ? '1' : '3')} items={[items[0], items[2]]} />
            </div>
        )
    }

    return (
        <div style={{ padding: '20px' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
        </div>
    )
}

export default VivalApprovals