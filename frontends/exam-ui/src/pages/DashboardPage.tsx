import React from 'react';
import { useAuth } from '../auth/AuthContext';
import CandidateDashboard from './roles/CandidateDashboard';
import ProctorDashboard from './roles/ProctorDashboard';
import AdminDashboard from './roles/AdminDashboard';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'CANDIDATE':
      return <CandidateDashboard />;
    case 'PROCTOR':
    case 'REVIEWER':
      return <ProctorDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    default:
      return <div>Không xác định vai trò: {user?.role}</div>;
  }
};

export default DashboardPage;
