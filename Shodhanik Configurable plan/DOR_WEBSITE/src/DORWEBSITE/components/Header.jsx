import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import menuItems from './Menu/HeaderMenu';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useHeaderSettings } from '@/hooks/useHeaderSettings';

// Get login URL based on environment stage
const getLoginUrl = () => {
  const stage = import.meta.env.VITE_APP_STAGE || 'development';
  const loginUrls = {
    development: import.meta.env.VITE_UI_LOGIN_LOCAL || 'http://localhost:5173',
    livetest: import.meta.env.VITE_UI_LOGIN_LIVETEST || 'http://192.168.1.27:84',
    production: import.meta.env.VITE_UI_LOGIN_PRODUCTION || 'http://shodnik.com',
  };
  return loginUrls[stage] || loginUrls.development;
};

const Header = () => {
  const { headerSettings, loading } = useHeaderSettings(1, { enableCache: true });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(null);

  // Get logo URL with proper base path
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return '';
    
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
      return logoPath;
    }
    
    if (logoPath.startsWith('data:image/')) {
      return logoPath;
    }
    
    const baseURL = getBaseFileURL();
    const cleanPath = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
    return `${baseURL}${cleanPath}`;
  };

  // Show loading state
  if (loading) {
    return (
      <header className="w-full shadow-md">
        <div className="bg-gray-200 animate-pulse">
          <div className="h-8 bg-gray-300"></div>
          <div className="h-24 bg-gray-100"></div>
          <div className="h-12 bg-gray-300"></div>
        </div>
      </header>
    );
  }

  const handleMouseEnter = (itemName) => {
    setOpenDropdown(itemName);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const toggleMobileDropdown = (itemName) => {
    setMobileDropdownOpen(mobileDropdownOpen === itemName ? null : itemName);
  };

  // Get data from API
  const universityNameHindi = headerSettings?.universityNameHindi;
  const universityNameEnglish = headerSettings?.universityNameEnglish;
  const approvalText = headerSettings?.approvalText;
  const logoUrl = getLogoUrl(headerSettings?.logo);
  const rmsLogoUrl = getLogoUrl(headerSettings?.rmsLogo);

  return (
    <header className="w-full shadow-md">
      {/* Top Blue Bar */}
      <div 
        className="text-white text-xs py-2 px-4"
        style={{ background: `linear-gradient(to right, ${headerSettings?.topBarColor || '#0066cc'}, ${headerSettings?.topBarColor || '#0066cc'}dd)` }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-center md:text-left">
            <span className="hidden lg:inline">
              {headerSettings?.helpline && `Technical Helpline : ${headerSettings.helpline}`}
              {headerSettings?.workingHours && `, Working Days ${headerSettings.workingHours}`}
              {headerSettings?.email && `, Email : ${headerSettings.email}`}
            </span>
            <span className="lg:hidden">
              {headerSettings?.helpline && `Helpline: ${headerSettings.helpline}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {headerSettings?.websiteTitle && (
              <span className="font-medium hidden sm:inline">{headerSettings.websiteTitle}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white py-4 px-4 border-b-2 border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left - University Logo and Info */}
          <div className="flex items-center gap-6 text-center sm:text-left flex-1">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <img 
                src={logoUrl}
                alt="University Logo"
                className="object-contain"
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold text-black mb-1">
                {universityNameHindi}
              </h1>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">
                {universityNameEnglish}
              </h2>
              <h3 className="text-lg font-semibold text-gray-700 italic">
                {approvalText}
              </h3>
            </div>
          </div>

          {/* Right - RMS Logo */}
          <a 
            href={getLoginUrl()}
            className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity duration-200"
            title="Go to Login"
          >
            <img
              src={rmsLogoUrl}
              alt="Research Management System"
              className="h-20 object-contain"
            />
          </a>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav 
        className="text-white sticky top-0 z-50 shadow-lg"
        style={{ background: `linear-gradient(to right, ${headerSettings?.navBarColor || '#003366'}, ${headerSettings?.navBarColor || '#003366'}cc)` }}
      >
        <div className="w-full px-2">
          {/* Desktop Menu */}
          <ul className="hidden lg:flex flex-wrap items-center justify-center text-xs font-medium">
            {menuItems.map((item, index) => (
              <li
                key={index}
                className="relative"
                onMouseEnter={() => item.hasDropdown && handleMouseEnter(item.name)}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  to={item.path}
                  className="px-2 xl:px-3 py-2.5 hover:bg-[#005599] transition-all duration-200 flex items-center gap-1 whitespace-nowrap hover:shadow-inner"
                >
                  {item.icon && <item.icon size={12} className="flex-shrink-0" />}
                  <span className="hidden xl:inline">{item.name}</span>
                  <span className="xl:hidden">{item.name.split(' ')[0]}</span>
                  {item.hasDropdown && (
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 flex-shrink-0 ${openDropdown === item.name ? 'rotate-180' : ''
                        }`}
                    />
                  )}
                </Link>

                {/* Desktop Dropdown Menu */}
                {item.hasDropdown && openDropdown === item.name && (
                  <div
                    className="absolute left-0 top-full bg-white shadow-2xl min-w-[280px] z-50 border border-gray-200 rounded-b-md mt-1 hover:bg-gray-50 transition-colors duration-200"
                    onMouseEnter={() => setOpenDropdown(item.name)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <ul className="py-2">
                      {item.links.map((link, linkIndex) => (
                        <li key={linkIndex} className="border-b border-gray-100 last:border-b-0">
                          <Link
                            to={link.path}
                            className="block px-6 py-3 hover:bg-gray-100 transition-colors duration-200 text-sm text-gray-700"
                          >
                            {link.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3">
            <span className="font-semibold text-sm">Navigation Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 hover:bg-[#004080] rounded-md transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="lg:hidden bg-[#002244] border-t border-[#004080] max-h-[70vh] overflow-y-auto">
              <ul className="flex flex-col">
                {menuItems.map((item, index) => (
                  <li key={index} className="border-b border-[#003366] last:border-b-0">
                    {item.hasDropdown ? (
                      <div>
                        <button
                          onClick={() => toggleMobileDropdown(item.name)}
                          className="w-full px-4 py-3 hover:bg-[#003d66] transition-colors duration-200 flex items-center justify-between text-sm text-left"
                        >
                          <span className="flex items-center gap-2">
                            {item.icon && <item.icon size={16} />}
                            {item.name}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${mobileDropdownOpen === item.name ? 'rotate-180' : ''
                              }`}
                          />
                        </button>
                        {mobileDropdownOpen === item.name && (
                          <ul className="bg-[#001a33]">
                            {item.links.map((link, linkIndex) => (
                              <li key={linkIndex} className="border-t border-[#003366]">
                                <Link
                                  to={link.path}
                                  className="block px-8 py-2 hover:bg-[#002d4d] transition-colors duration-200 text-xs"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {link.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={item.path}
                        className="flex items-center gap-2 px-4 py-3 hover:bg-[#003d66] transition-colors duration-200 text-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.icon && <item.icon size={16} />}
                        {item.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
