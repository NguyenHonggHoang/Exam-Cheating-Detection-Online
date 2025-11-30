import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './pages/App';
import './index.css';
// Initialize axios interceptors for automatic token injection and refresh
// authService.createAuthInterceptor(); // Removed: handled by BFF/ApiClient

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
