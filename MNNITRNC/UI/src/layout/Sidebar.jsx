import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useAccess } from '../access/useAccess';
import { CATEGORY_ORDER, DEFAULT_CATEGORY, PAGE_CATEGORIES } from './sidebarCategories';
import { 
  LayoutDashboard, FileText, CreditCard, Users, 
  CalendarDays, Building2, BarChart3, Settings, 
  ShieldCheck, PanelLeftClose, PanelLeftOpen, Folder, X
} from 'lucide-react';

const CATEGORY_ICONS = {
  'General': <LayoutDashboard size={20} />,
  'Proposal': <FileText size={20} />,
  'Payment': <CreditCard size={20} />,
  'Recruitment': <Users size={20} />,
  'Fellowship & Leave': <CalendarDays size={20} />,
  'HOD Portal': <Building2 size={20} />,
  'Reports': <BarChart3 size={20} />,
  'Office Admin': <Settings size={20} />,
  'Admin': <ShieldCheck size={20} />
};

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { user } = useAuth();
  const { modules, isLoading } = useAccess();
  const location = useLocation();
  const [openCategory, setOpenCategory] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userRoles = user?.roles || [];

  const categories = useMemo(() => {
    const rawLinks = modules.flatMap((module) =>
      module.pages
        .filter((page) => page.isNavigable)
        .map((page) => ({
          key: page.key || page.pageKey,
          name: page.name || page.pageName,
          path: page.route,
        })),
    );

    const seenPaths = new Set();
    const links = rawLinks.filter((link) => {
      if (!link.path || seenPaths.has(link.path)) return false;
      if (link.key && link.key.startsWith('project-types.type')) return false;
      if (link.path === '/approved-requests') return false;
      seenPaths.add(link.path);
      return true;
    });

    const byCategory = new Map();
    for (const link of links) {
      const category = PAGE_CATEGORIES[link.key] || DEFAULT_CATEGORY;
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(link);
    }

    const ordered = [...CATEGORY_ORDER, ...byCategory.keys()].filter(
      (name, index, all) => all.indexOf(name) === index,
    );

    return ordered
      .filter((name) => byCategory.has(name))
      .map((name) => ({ name, links: byCategory.get(name) }));
  }, [modules, user]);

  useEffect(() => {
    setOpenCategory((current) => {
      const activeCategory = categories.find((category) =>
        category.links.some((link) => location.pathname.startsWith(link.path)),
      );
      if (activeCategory) return activeCategory.name;
      if (current === null && categories.length > 0) return categories[0].name;
      return current;
    });
  }, [location.pathname, categories]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar container */}
      <div className={`fixed inset-y-0 left-0 z-50 md:static bg-slate-800 dark:bg-slate-950 text-white min-h-screen flex flex-col shadow-xl border-r border-slate-700 dark:border-slate-800 transition-all duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isCollapsed ? 'md:w-20' : 'w-64'}`}>
      <div className={`p-4 border-b border-slate-700 dark:border-slate-800 flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} min-h-[80px]`}>
        <div className="h-10 w-10 flex items-center justify-center bg-white rounded-full p-1 shadow-md shrink-0">
          <img src={`${import.meta.env.BASE_URL}images/MNNIT_LOGO.png`} alt="MNNIT Logo" className="h-full w-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden transition-all duration-300 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-extrabold tracking-wider text-blue-400">MNNITA R&C</h2>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-widest truncate w-full" title={userRoles.join(', ')}>
                {userRoles.join(', ')}
              </p>
            </div>
            {/* Mobile close button */}
            <button 
              className="md:hidden text-slate-400 hover:text-white" 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-400">{isCollapsed ? '...' : 'Loading…'}</p>
        ) : (
          categories.map((category) => {
            const isOpen = openCategory === category.name;
            const Icon = CATEGORY_ICONS[category.name] || <Folder size={20} />;
            
            return (
              <div key={category.name} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      setIsCollapsed(false);
                      setOpenCategory(category.name);
                    } else {
                      setOpenCategory(isOpen ? null : category.name);
                    }
                  }}
                  title={isCollapsed ? category.name : undefined}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-3 rounded-lg text-sm font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-800 hover:text-white transition-all duration-200`}
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0">{Icon}</span>
                    {!isCollapsed && <span>{category.name}</span>}
                  </div>
                  {!isCollapsed && (
                    <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  )}
                </button>
                {isOpen && !isCollapsed && (
                  <div className="mt-1 space-y-1">
                    {category.links.map((link) => {
                      const isActive = location.pathname.startsWith(link.path);
                      return (
                        <Link
                          key={link.key}
                          to={link.path}
                          className={`block pl-10 pr-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      <div className="hidden md:flex p-4 border-t border-slate-700 dark:border-slate-800 justify-center">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors w-full flex justify-center"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
    </div>
    </>
  );
}
