import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  subtitle,
  status = 'neutral',
  onClick
}) => {

  const trendIcon = {
    up: <TrendingUp className="w-3 h-3" />,
    down: <TrendingDown className="w-3 h-3" />,
    neutral: <Minus className="w-3 h-3" />
  };

  // Full card theme based on status - 8+ color options
  const getStatusTheme = (status) => {
    switch(status) {
      case 'success':
        return {
          bg: 'bg-green-50 hover:bg-green-100 border-green-200',
          icon: 'bg-green-100 text-green-600',
          title: 'text-green-900',
          value: 'text-green-900',
          subtitle: 'text-green-700'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
          icon: 'bg-yellow-100 text-yellow-600',
          title: 'text-yellow-900',
          value: 'text-yellow-900',
          subtitle: 'text-yellow-700'
        };
      case 'danger':
        return {
          bg: 'bg-red-50 hover:bg-red-100 border-red-200',
          icon: 'bg-red-100 text-red-600',
          title: 'text-red-900',
          value: 'text-red-900',
          subtitle: 'text-red-700'
        };
      case 'info':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
          icon: 'bg-blue-100 text-blue-600',
          title: 'text-blue-900',
          value: 'text-blue-900',
          subtitle: 'text-blue-700'
        };
      case 'pending':
        return {
          bg: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
          icon: 'bg-orange-100 text-orange-600',
          title: 'text-orange-900',
          value: 'text-orange-900',
          subtitle: 'text-orange-700'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
          icon: 'bg-purple-100 text-purple-600',
          title: 'text-purple-900',
          value: 'text-purple-900',
          subtitle: 'text-purple-700'
        };
      case 'teal':
        return {
          bg: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
          icon: 'bg-teal-100 text-teal-600',
          title: 'text-teal-900',
          value: 'text-teal-900',
          subtitle: 'text-teal-700'
        };
      case 'pink':
        return {
          bg: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
          icon: 'bg-pink-100 text-pink-600',
          title: 'text-pink-900',
          value: 'text-pink-900',
          subtitle: 'text-pink-700'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
          icon: 'bg-indigo-100 text-indigo-600',
          title: 'text-indigo-900',
          value: 'text-indigo-900',
          subtitle: 'text-indigo-700'
        };
      default:
        return {
          bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
          icon: 'bg-gray-100 text-gray-600',
          title: 'text-gray-900',
          value: 'text-gray-900',
          subtitle: 'text-gray-700'
        };
    }
  };

  const theme = getStatusTheme(status);

  return (
    <div
      onClick={onClick}
      className={`
        group cursor-pointer
        border rounded-lg p-4
        shadow-sm transition-all
        hover:shadow-md hover:-translate-y-[2px]
        ${theme.bg}
      `}
    >
      {/* Top Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.title}`}>{title}</p>
          <h3 className={`text-2xl font-bold ${theme.value}`}>{value}</h3>
        </div>

        {icon && (
          <div className={`w-10 h-10 rounded-md flex items-center justify-center ${theme.icon}`}>
            {icon}
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="flex items-center justify-between">
        <div>
          {(trend || trendValue) && (
            <div
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                trend === 'up'
                  ? 'bg-green-100 text-green-700'
                  : trend === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {trendIcon[trend || 'neutral']}
              {trendValue}
            </div>
          )}

          {subtitle && (
            <p className={`text-xs mt-1 ${theme.subtitle}`}>{subtitle}</p>
          )}
        </div>

        {/* Navigation Arrow */}
        <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition ${theme.subtitle}`} />
      </div>
    </div>
  );
};

export default StatsCard;

/**
 * ============================================
 * HOW TO USE STATSCARD COMPONENT
 * ============================================
 * 
 * BASIC USAGE:
 * ------------
 * import StatsCard from '@/components/StatsCard.';
 * import { Users } from 'lucide-react';
 * 
 * <StatsCard
 *   title="Total Users"
 *   value="1,234"
 *   subtitle="Active users this month"
 *   icon={<Users className="w-6 h-6" />}
 *   status="success"
 *   onClick={() => navigate('/users')}
 * />
 * 
 * 
 * PROPS:
 * ------
 * @param {string} title - Card title (required)
 * @param {string} value - Main value/number to display (required)
 * @param {ReactNode} icon - Icon component from lucide-react (optional)
 * @param {string} subtitle - Subtitle text below the card (optional)
 * @param {string} status - Color theme for the card (optional, default: 'neutral')
 * @param {string} trend - Trend direction: 'up', 'down', 'neutral' (optional)
 * @param {string} trendValue - Trend value text like '+12%' (optional)
 * @param {function} onClick - Click handler function (optional)
 * 
 * 
 * AVAILABLE STATUS COLORS:
 * ------------------------
 * - 'success'  → Green theme (for positive/completed items)
 * - 'warning'  → Yellow theme (for items needing attention)
 * - 'danger'   → Red theme (for critical/error items)
 * - 'info'     → Blue theme (for informational items)
 * - 'pending'  → Orange theme (for pending/in-progress items)
 * - 'purple'   → Purple theme
 * - 'teal'     → Teal theme
 * - 'pink'     → Pink theme
 * - 'indigo'   → Indigo theme
 * - 'neutral'  → Gray theme (default)
 * 
 * 
 * EXAMPLE WITH TREND:
 * -------------------
 * <StatsCard
 *   title="Revenue"
 *   value="$45,231"
 *   subtitle="Total revenue this month"
 *   icon={<DollarSign className="w-6 h-6" />}
 *   status="success"
 *   trend="up"
 *   trendValue="+12.5%"
 *   onClick={() => console.log('View revenue details')}
 * />
 * 
 * 
 * EXAMPLE IN GRID LAYOUT:
 * -----------------------
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 *   <StatsCard title="Total" value="100" status="info" />
 *   <StatsCard title="Pending" value="25" status="warning" />
 *   <StatsCard title="Completed" value="70" status="success" />
 *   <StatsCard title="Failed" value="5" status="danger" />
 * </div>
 * 
 * 
 * USING WITH DASHBOARD DATA JSON:
 * -------------------------------
 * // In dashboardData.json
 * {
 *   "stats": [
 *     {
 *       "title": "Applications",
 *       "value": "0160",
 *       "subtitle": "New applications",
 *       "icon": "ClipboardList",
 *       "status": "info"
 *     }
 *   ]
 * }
 * 
 * // In your component
 * {dashboardData.stats.map((item, index) => {
 *   const IconComponent = getIconComponent(item.icon);
 *   return (
 *     <StatsCard
 *       key={index}
 *       title={item.title}
 *       value={item.value}
 *       subtitle={item.subtitle}
 *       icon={IconComponent ? <IconComponent className="w-6 h-6" /> : null}
 *       status={item.status}
 *       onClick={() => handleClick(item)}
 *     />
 *   );
 * })}
 */
