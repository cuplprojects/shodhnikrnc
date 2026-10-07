// services/platformCheck.js

/**
 * Check if the platform is WEB based on VITE_PLATFORM environment variable
 * @returns {boolean} - true if platform is WEB, false otherwise
 */
export const isWeb = import.meta.env.VITE_PLATFORM === 'WEB';

/**
 * Check if the platform is DESKTOP
 * @returns {boolean} - true if platform is DESKTOP, false otherwise
 */
export const isDesktop = import.meta.env.VITE_PLATFORM === 'DESKTOP';

/**
 * Get the current platform from environment variables
 * @returns {string} - the platform value (WEB or DESKTOP)
 */
export const getPlatform = () => {
  return import.meta.env.VITE_PLATFORM;
};

/**
 * Platform check utilities object
 */
export const platform = {
  isWeb: isWeb,
  isDesktop: isDesktop,
  current: getPlatform(),
};

/*
**Example Usage**

import { isWeb, isDesktop } from '@/services/platformCheck';

function MyComponent() {
  return (
    <div>
      {isWeb && <div>Content for web version only</div>}
      {isDesktop && <div>Content for desktop version only</div>}
    </div>
  );
}


*/
