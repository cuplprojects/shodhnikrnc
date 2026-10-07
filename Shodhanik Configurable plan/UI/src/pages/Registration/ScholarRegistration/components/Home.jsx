import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-[#111827] font-inter mb-4">
        Welcome to Ph.D. Admission Registration
      </h2>
      <p className="text-[#6b7280] mb-6">
        Thank you for choosing Chaudhary Charan Singh University, Meerut for your Ph.D. studies.
      </p>
      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1e40af] mb-3 font-inter">
          Instructions:
        </h3>
        <ul className="list-disc list-inside space-y-2 text-[#374151]">
          <li>Complete all steps in order</li>
          <li>Keep all required documents ready for upload</li>
          <li>Ensure all information is accurate before submission</li>
          <li>You can save your progress and return later</li>
        </ul>
      </div>
      <button 
        onClick={() => navigate('/register-scholar/personal-info')}
        className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white py-3 px-8 rounded-lg font-semibold font-inter transition-all duration-200 hover:from-[#1e3a8a] hover:to-[#2563eb] shadow-md hover:shadow-lg flex items-center gap-2"
      >
        Start Application
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default Home;
