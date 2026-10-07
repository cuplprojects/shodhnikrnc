import PrintHeader from "@/components/cms/PrintHeader";


const TopBar = () => {
    return (
        <div className="bg-white text-[#1e40af] px-4 md:px-8 py- md:py-2 border-b border-[#e5e7eb]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Logo */}
                <PrintHeader/>

                {/* RMS Logo */}
                <div className="flex items-center justify-center sm:justify-end">
                    <img 
                        src="/university/ccsu/rms.png" 
                        alt="Shodhanik Logo" 
                        className="h-24 md:h-32 w-auto object-contain pointer-events-none select-none"
                    />
                </div>
            </div>
        </div>
    )
}

export default TopBar