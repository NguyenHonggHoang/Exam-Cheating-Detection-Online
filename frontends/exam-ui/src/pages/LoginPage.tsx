import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy Login Page - Deprecated
 * This page redirects to LoginPageNew for real authentication.
 * Kept only for backward compatibility with old links.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
};

export default LoginPage;
