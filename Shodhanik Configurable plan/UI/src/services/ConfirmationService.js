// src/services/ConfirmationService.js
let listeners = [];

export const confirm = (options = {}) => {
  return new Promise((resolve) => {
    listeners.forEach((cb) => cb({ ...options, resolve }));
  });
};

export const subscribeToConfirm = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};


const ConfirmationService = {
    confirm,
    subscribeToConfirm
};

export default ConfirmationService;



//example usage:

/* 
import { confirm } from '@/services/ConfirmationService';

const handleLogout = async () => {
    // const confirmed = await confirm(); // shows default message

    // custom message and title
    //const confirmed = await confirm({
    //  title: "Test Confirmation Dialog",
    //  message: "This is a test confirmation dialog. Do you want to proceed?",
    // });

    if (confirmed) {
      notification().success('Logged out');
      // Perform logout logic here (e.g. clear tokens, redirect, etc.)
    } else {
      notification().info('Logout cancelled');
    }
  };

   return (
    <div className="bg-white shadow p-4 flex justify-end">
      <button
        onClick={handleLogout}
        className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700 transition"
      >
        Logout
      </button>
    </div>
  );

};

*/