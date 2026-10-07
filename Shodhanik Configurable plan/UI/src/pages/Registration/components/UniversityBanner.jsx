import { Home, Menu, X } from 'lucide-react'
import React from 'react'


const UniversityBanner = ({
    toggleSidebar,
    handleHomeClick,
    isSidebarOpen
}) => {
    return (
        <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white px-4 md:px-8 py-2 md:py-2">
            <div className="max-w-7xl mx-auto relative">
                {/* Mobile Menu Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="lg:hidden absolute mt-3 left-0 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* Home Button - Desktop */}
                <button
                    onClick={handleHomeClick}
                    className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                    title="Go to Home"
                >
                    <Home size={24} />
                </button>

                <h1 className="text-xl md:text-2xl lg:text-3xl font-bold font-inter text-center">
                    Chaudhary Charan Singh University, Meerut
                </h1>
                <p className="text-sm md:text-base text-center mt-2 font-inter opacity-90">
                    Ph.D. Admission-25
                </p>

                {/* Home Button - Mobile (right side) */}
                <button
                    onClick={handleHomeClick}
                    className="lg:hidden absolute mt-3 right-0 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all duration-200"
                    title="Go to Home"
                >
                    <Home size={24} />
                </button>
            </div>
        </div>
    )
}

export default UniversityBanner