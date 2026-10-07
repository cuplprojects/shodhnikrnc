import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-slate-800 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Research Areas */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-b-2 border-blue-500 pb-2">
              Research Areas
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/research-areas/agriculture" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Agriculture
                </Link>
              </li>
              <li>
                <Link to="/research-areas/arts" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Arts
                </Link>
              </li>
              <li>
                <Link to="/research-areas/ayurved" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Ayurved
                </Link>
              </li>
              <li>
                <Link to="/research-areas/commerce" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Commerce
                </Link>
              </li>
              <li>
                <Link to="/research-areas/education" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Education
                </Link>
              </li>
              <li>
                <Link to="/research-areas/engineering-tech" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Engg. & Tech.
                </Link>
              </li>
              <li>
                <Link to="/research-areas/law" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Law
                </Link>
              </li>
              <li>
                <Link to="/research-areas/management" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Management
                </Link>
              </li>
              <li>
                <Link to="/research-areas/science" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Faculty of Science
                </Link>
              </li>
            </ul>
          </div>

          {/* About DoR */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-b-2 border-blue-500 pb-2">
              About DoR
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/about-dor" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  About DoR
                </Link>
              </li>
              <li>
                <Link to="/research-policy" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Research Policy
                </Link>
              </li>
              <li>
                <Link to="/vision-mission" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Mission & Vision
                </Link>
              </li>
              <li>
                <Link to="/vc-message" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Vice Chancellor's Message
                </Link>
              </li>
              <li>
                <Link to="/director-message" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Director's Message
                </Link>
              </li>
              <li>
                <Link to="/associate-directors" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Associate Directors
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-b-2 border-blue-500 pb-2">
              Quick Links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/contact-us" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Phone Directory
                </Link>
              </li>
              <li>
                <Link to="/about-dor" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  About University
                </Link>
              </li>
              <li>
                <Link to="/ordinance" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Ph. D. Ordinance
                </Link>
              </li>
              <li>
                <Link to="/downloads" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Downloads
                </Link>
              </li>
              <li>
                <Link to="/contact-us" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/research-projects" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  Funding Agencies
                </Link>
              </li>
            </ul>
          </div>

          {/* Research Management System (RMS) */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-b-2 border-blue-500 pb-2 inline-block">SHODHANIK</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/home" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:pl-2 group flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 transition-all duration-300 group-hover:scale-125"></span>
                  SHODHANIK Login
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div className="bg-slate-900 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-gray-400">
            <span>Copyright © All Rights Reserved 2021</span>
            <span className="hidden md:inline">|</span>
            <Link to="/contact-us" className="hover:text-white transition-colors duration-200">
              Privacy Policy
            </Link>
            <span className="hidden md:inline">|</span>
            <Link to="/contact-us" className="hover:text-white transition-colors duration-200">
              Disclaimer
            </Link>
            <span className="hidden md:inline">|</span>
            <Link to="/contact-us" className="hover:text-white transition-colors duration-200">
              Terms & Conditions
            </Link>
            <span className="hidden md:inline">|</span>
            <Link to="/contact-us" className="hover:text-white transition-colors duration-200">
              Payment & Refunds Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
