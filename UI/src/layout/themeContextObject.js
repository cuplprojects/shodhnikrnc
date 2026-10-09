import { createContext } from 'react';

/// Kept out of ThemeContext.jsx so that file exports only components; mixing a
/// component and a non-component export in one file breaks React Fast Refresh.
export const ThemeContext = createContext();
