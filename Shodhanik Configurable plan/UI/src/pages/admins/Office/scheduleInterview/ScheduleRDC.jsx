import { useState } from 'react'

//tab components imports
import AllCandidatesForInterview from './components/AllCandidatesForRDC'

const ScheduleRDC = () => {
    return (
        <div style={{ padding: '20px' }}>
            <AllCandidatesForInterview />
        </div>
    )
}
export default ScheduleRDC