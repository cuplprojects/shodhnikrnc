import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-[#111827] font-inter mb-4">
        Welcome to Supervisor Registration
      </h2>
      <p className="text-[#6b7280] mb-6">
        Thank you for your interest in becoming a supervisor at Chaudhary Charan Singh University, Meerut.
      </p>
      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1e40af] mb-3 font-inter">
          Registration Process:
        </h3>
        <ul className="list-disc list-inside space-y-2 text-[#374151]">
          <li>Complete all registration steps in order</li>
          <li>Prepare all required documents and research papers</li>
          <li>Ensure all academic and professional information is accurate</li>
          <li>Upload supporting documents as required</li>
          <li>Review your application before final submission</li>
          <li>You can save your progress and return later</li>
        </ul>
      </div>
      <div className="bg-[#fef3c7] border border-[#fbbf24] rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-[#92400e] mb-2">
          Required Documents:
        </h4>
        <p className="text-sm text-[#92400e]">
          Please keep your academic certificates, research publications, and identity documents ready for upload during the registration process.
        </p>
      </div>
      <button 
        onClick={() => navigate(SUPERVISOR_REGISTRATION_ROUTES.PERSONAL_INFO)}
        className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white py-3 px-8 rounded-lg font-semibold font-inter transition-all duration-200 hover:from-[#1e3a8a] hover:to-[#2563eb] shadow-md hover:shadow-lg flex items-center gap-2"
      >
        Start Registration
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default Home;