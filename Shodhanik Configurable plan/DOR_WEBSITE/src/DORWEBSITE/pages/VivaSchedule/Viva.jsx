// This file redirects to the main VivaSchedules page
// The main implementation is in pages/Scholars/VivaSchedules.jsx

import { Navigate } from 'react-router-dom';

const Viva = () => {
    // Redirect to the main Viva Schedules page
    return <Navigate to="/dor-website/scholars/viva-schedules" replace />;
};

export default Viva;
