import { useHeaderSettings } from '@/hooks/useHeaderSettings';

const OuterFooter = () => {
    const { headerSettings, loading } = useHeaderSettings(1, { enableCache: true });

    // Show loading state
    if (loading) {
        return (
            <footer className="bg-[#1f2937] text-white px-4 md:px-8 py-3 mt-auto">
                <div className="text-center text-sm bg-gray-700 h-6 rounded animate-pulse"></div>
            </footer>
        );
    }

    const universityNameEnglish = headerSettings?.universityNameEnglish;

    return (
        <footer className="bg-[#1f2937] text-white px-4 md:px-8 py-3 mt-auto">
            <div className="text-center text-sm">
                © Copyright Protected. {universityNameEnglish}. <br/>
                Best Viewed and Working with Google Chrome or Microsoft Edge browser.
            </div>
        </footer>
    )
}

export default OuterFooter