import { useContext } from 'react';
import { AccessContext } from './accessContextObject';

export const useAccess = () => useContext(AccessContext);
