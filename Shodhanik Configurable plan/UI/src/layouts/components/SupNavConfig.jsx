
// Supervisor navigation configuration  
// Now uses centralized route configuration
import { generateSupervisorNavConfig } from '@/services/routeService';

// 🔑 Function to filter menus by permissions
export const getSupNavConfig = () => {
  // Generate navigation from centralized config
  return generateSupervisorNavConfig();
};

