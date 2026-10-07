import { useHeaderSettings } from '@/hooks/useHeaderSettings';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const PrintHeader = ({ isSmall = false, showAddress = true }) => {
    const { headerSettings, loading } = useHeaderSettings(1, { enableCache: true });
    
    const logoSize = isSmall ? "w-12 h-12" : "w-20 h-20";
    const titleSize = isSmall ? "text-lg" : "text-3xl";
    const subtitleSize = isSmall ? "text-xs" : "text-lg";
    const marginSize = isSmall ? "ms-3" : "ms-6";

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
            <div className="text-center mb-0 pointer-events-none select-none">
                <div className="flex items-center justify-between">
                    <div className={`${logoSize} bg-gray-200 rounded-full flex items-center justify-center animate-pulse`} />
                    <div className={`flex-1 text-center ${marginSize}`}>
                        <div className={`${titleSize} font-bold text-gray-300 mb-1 bg-gray-200 h-6 rounded animate-pulse`} />
                        <div className={`${subtitleSize} font-semibold text-gray-300 mb-1 bg-gray-200 h-4 rounded animate-pulse`} />
                    </div>
                </div>
            </div>
        );
    }

    // Get data from API
    const universityNameHindi = headerSettings?.universityNameHindi;
    const universityNameEnglish = headerSettings?.universityNameEnglish;
    const approvalText = headerSettings?.approvalText;
    const logoUrl = getLogoUrl(headerSettings?.logo);
    const topBarColor = headerSettings?.topBarColor || '#0066cc';

    return (
        <div className="text-center mb-0 pointer-events-none select-none">
            <div className="flex items-center justify-between">
                <div className={`${logoSize} bg-gray-200 rounded-full flex items-center justify-center`}>
                    <img 
                        src={logoUrl}
                        alt="University Logo"
                        className="pointer-events-none select-none object-contain"
                    />
                </div>
                <div className={`flex-1 text-center ${marginSize}`}>
                    <h1 className={`${titleSize} font-bold text-black mb-1`}>
                        {universityNameHindi}
                    </h1>
                    <h2 className={`${subtitleSize} font-semibold text-gray-700 mb-1`}>
                        {universityNameEnglish}
                    </h2>
                    {showAddress &&
                        <h3 className={`${subtitleSize} font-semibold text-gray-700 italic`}>
                            {approvalText}
                        </h3>
                    }
                </div>
            </div>
        </div>
    )
}

export default PrintHeader