// ipTracker.js
export const getIP = async () => {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  return data.ip;
};


/*
Useage:

import { getIP } from './ipTracker.js';

const ip = await getIP();


*/