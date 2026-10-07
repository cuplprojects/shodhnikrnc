import { useNavigate } from "react-router-dom";

const MenuBar = () => {

  const navigate = useNavigate();
  
  // Get DOR website URL from environment
  const dorWebsiteUrl = {
    development: import.meta.env.VITE_DOR_WEBSITE_LOCAL,
    livetest: import.meta.env.VITE_DOR_WEBSITE_LIVETEST,
    production: import.meta.env.VITE_DOR_WEBSITE_PRODUCTION,
  }[import.meta.env.VITE_APP_STAGE]; 

  return (
    <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto">
        <nav className="flex flex-wrap items-center gap-6 text-sm font-medium font-inter">
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            Home
          </a>
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            About
          </a>
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            Academics
          </a>
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            Admissions
          </a>
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            Research
          </a>
          <a
            href="#"
            className="text-white hover:text-blue-100 transition-colors duration-150"
          >
            Contact
          </a>

          {/* Right-aligned links */}
          <div className="ml-auto flex gap-6">
            <a
              href={dorWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-blue-100 transition-colors duration-150 cursor-pointer"
            >
              DOR Website
            </a>
            <button
              onClick={()=>{navigate('/register-scholar')}}
              className="text-white hover:text-blue-100 transition-colors duration-150"
            >
              Scholar Registration
            </button>
            <button
              onClick={()=>{navigate('/register-supervisor/login')}}
              className="text-white hover:text-blue-100 transition-colors duration-150"
            >
              Supervisor Registration
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default MenuBar;
