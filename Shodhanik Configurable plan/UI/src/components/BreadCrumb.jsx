// src/components/Breadcrumb.jsx
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Optional: human-friendly label map
const routeLabelMap = {
  'dashboard': 'Dashboard',
  'settings': 'Settings',
  'profile': 'Profile',
  'supervisor-dashboard': 'Supervisor Dashboard',
  'conference-approval': 'Conference Approval',
  'view': 'View Details'
};

const Breadcrumb = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const segments = location.pathname.split('/').filter(Boolean);

  // Debug logging
  // console.log('Breadcrumb - Current location:', location.pathname, 'Search:', location.search);

  const crumbs = segments.map((segment, index) => {
    const to = '/' + segments.slice(0, index + 1).join('/');
    const label = routeLabelMap[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isLast = index === segments.length - 1;

    // Special handling for conference-approval route
    let linkTo = to;
    if (!isLast) {
      if (segment === 'conference-approval' || to.includes('conference-approval')) {
        // Try to get status from current URL or from sessionStorage as fallback
        const currentStatus = searchParams.get('status') || 
                            sessionStorage.getItem('conferenceApprovalStatus') || 
                            '0';
        linkTo = `${to}?status=${currentStatus}`;
        console.log(`Conference approval breadcrumb - Using status: ${currentStatus}`);
      } else {
        linkTo = `${to}${location.search}`;
      }
    }
    
    // Debug logging for each breadcrumb link
    // if (!isLast) {
    //   console.log(`Breadcrumb link - Segment: ${segment}, To: ${linkTo}`);
    // }

    return (
      <div className="flex items-center" key={to}>
        {!isLast ? (
          <>
            <Link 
              to={linkTo}
              className="text-sm text-slate-600 hover:underline capitalize"
            >
              {label}
            </Link>
            <ChevronRight className="mx-1 h-4 w-4 text-gray-400" />
          </>
        ) : (
          <span className="text-md text-gray-500 capitalize">{label}</span>
        )}
      </div>
    );
  });

  return (
    <nav className="mt-0.5 ml- flex items-center space-x-1 text-md">
      {crumbs}
    </nav>
  );
};

export default Breadcrumb;
