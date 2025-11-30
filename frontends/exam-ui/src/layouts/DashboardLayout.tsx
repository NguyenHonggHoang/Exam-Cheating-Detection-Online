import React, { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  // only run when user or navigate changes
  }, [user, navigate]);

  if (!user) return null;

  // Menu cho từng vai trò
  const getMenuItems = () => {
    switch (user.role) {
      case 'CANDIDATE':
        return [
          { path: '/dashboard', icon: '🏠', label: 'Trang chủ' },
          { path: '/candidate/exams', icon: '📝', label: 'Kỳ thi' },
          { path: '/candidate/my-results', icon: '📊', label: 'Kết quả của tôi' },
          { path: '/candidate/my-violations', icon: '⚠️', label: 'Vi phạm của tôi' },
        ];
      case 'PROCTOR':
      case 'REVIEWER':
        return [
          { path: '/dashboard', icon: '🏠', label: 'Trang chủ' },
          { path: '/proctor/active-exams', icon: '📝', label: 'Kỳ thi đang mở' },
          { path: '/proctor/violations', icon: '🚨', label: 'Danh sách vi phạm' },
          { path: '/proctor/live-monitoring', icon: '📹', label: 'Giám sát trực tiếp' },
        ];
      case 'ADMIN':
        return [
          { path: '/dashboard', icon: '🏠', label: 'Trang chủ' },
          { path: '/admin/manage-exams', icon: '📚', label: 'Quản lý kỳ thi' },
          { path: '/admin/exam-statistics', icon: '📈', label: 'Thống kê' },
          { path: '/admin/all-violations', icon: '⚠️', label: 'Tất cả vi phạm' },
          { path: '/admin/system-settings', icon: '⚙️', label: 'Cài đặt hệ thống' },
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        background: '#2d3748',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo */}
        <div style={{ padding: 20, borderBottom: '1px solid #4a5568' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            🎓 Exam System
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#a0aec0' }}>
            {user.role === 'CANDIDATE' && 'Thí sinh'}
            {(user.role === 'PROCTOR' || user.role === 'REVIEWER') && 'Giám thị'}
            {user.role === 'ADMIN' && 'Quản trị viên'}
          </p>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: isActive ? '#4a5568' : 'transparent',
                  color: 'white',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background 0.2s',
                  borderLeft: isActive ? '4px solid #3182ce' : '4px solid transparent'
                }}
                onMouseOver={(e) => {
                  if (!isActive) e.currentTarget.style.background = '#374151';
                }}
                onMouseOut={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: 16, borderTop: '1px solid #4a5568' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: '#c53030',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f7fafc' }}>
        {/* Topbar */}
        <div style={{
          height: 64,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1a202c' }}>
            {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: '#4a5568' }}>
              Chào, <strong>{user.username}</strong>
            </span>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 16
            }}>
              {(user.username || user.email || user.id || '?').charAt(0)}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;