
// Scholar navigation configuration
// Now uses centralized route configuration
import { generateScholarNavConfig } from '@/services/routeService';

// 🔑 Function to filter menus by permissions
export const getScholarNavConfig = () => {
  // Generate navigation from centralized config
  return generateScholarNavConfig();
};
