import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  skipProfileCheck?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  skipProfileCheck = false
}) => {
  const { user, loading, profileCompleted } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check profile completion for CANDIDATE role
  // Skip if already on profile completion page or if explicitly skipped
  if (
    !skipProfileCheck &&
    user.role === 'CANDIDATE' &&
    !profileCompleted &&
    location.pathname !== '/profile/complete'
  ) {
    console.log('[ProtectedRoute] Redirecting to profile completion');
    return <Navigate to="/profile/complete" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to dashboard instead of showing Unauthorized page
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
