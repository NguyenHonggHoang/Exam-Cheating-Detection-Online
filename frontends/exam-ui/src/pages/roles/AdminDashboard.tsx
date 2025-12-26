/**
 * AdminDashboard
 * 
 * Main admin dashboard with navigation to all admin features.
 * Shows quick stats and links to exam management, user management, and system monitoring.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { examsApi, type Exam } from '@/api/exams';
import { usersApi } from '@/api/users';
import { incidentsApi } from '@/api/incidents';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    totalViolations: 0,
  });
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const exams = await examsApi.getAll();

        // Fetch users count (page size 1 just to get totalElements)
        const usersResult = await usersApi.list({ page: 0, size: 1 });

        // Fetch incidents count
        const incidentsResult = await incidentsApi.list({ page: 0, size: 1 });

        setStats({
          totalExams: exams.length,
          activeExams: exams.filter(e => e.status === 'ACTIVE').length,
          totalStudents: usersResult.totalElements,
          totalViolations: incidentsResult.totalElements,
        });

        // Get 5 most recent exams
        setRecentExams(exams.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const quickActions = [
    {
      icon: '📝',
      title: 'Tạo Kỳ Thi',
      desc: 'Thêm kỳ thi mới',
      path: '/admin/exams/create',
      color: '#3182ce'
    },
    {
      icon: '👥',
      title: 'Quản Lý User',
      desc: 'Quản lý người dùng',
      path: '/admin/users',
      color: '#38a169'
    },
    {
      icon: '📊',
      title: 'Giám Sát',
      desc: 'Theo dõi hệ thống',
      path: '/admin/system',
      color: '#805ad5'
    },
    {
      icon: '⚠️',
      title: 'Vi Phạm',
      desc: 'Xem tất cả vi phạm',
      path: '/admin/incidents',
      color: '#e53e3e'
    }
  ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return { text: 'Đang diễn ra', color: '#38a169', bg: '#e8f5e9' };
      case 'UPCOMING': return { text: 'Sắp tới', color: '#3182ce', bg: '#e3f2fd' };
      case 'ENDED': return { text: 'Đã kết thúc', color: '#718096', bg: '#f5f5f5' };
      default: return { text: status, color: '#718096', bg: '#f5f5f5' };
    }
  };

  const getBrowserModeLabel = (mode: string) => {
    switch (mode) {
      case 'SEB_REQUIRED': return { text: 'SEB Bắt Buộc', color: '#e53e3e', icon: '🔒' };
      case 'SEB_OPTIONAL': return { text: 'SEB Khuyến Khích', color: '#d69e2e', icon: '⚡' };
      default: return { text: 'Browser Thường', color: '#718096', icon: '🌐' };
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
        borderRadius: 12,
        marginBottom: 24,
        color: 'white',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700 }}>
          Xin chào, {user?.username} 👑
        </h2>
        <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
          Bảng điều khiển quản trị hệ thống giám sát thi cử
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #3182ce'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#3182ce', marginBottom: 4 }}>
            {loading ? '...' : stats.totalExams}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng kỳ thi</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #38a169'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#38a169', marginBottom: 4 }}>
            {loading ? '...' : stats.activeExams}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Đang diễn ra</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #805ad5'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#805ad5', marginBottom: 4 }}>
            {loading ? '...' : stats.totalStudents}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng thí sinh</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderLeft: '4px solid #e53e3e'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#e53e3e', marginBottom: 4 }}>
            {loading ? '...' : stats.totalViolations}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng vi phạm</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {quickActions.map((action, idx) => (
          <div
            key={idx}
            onClick={() => navigate(action.path)}
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
              border: '2px solid transparent',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              e.currentTarget.style.borderColor = action.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>{action.icon}</div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 16, color: '#1a202c', fontWeight: 600 }}>
              {action.title}
            </h4>
            <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>{action.desc}</p>
          </div>
        ))}
      </div>

      {/* Recent Exams */}
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#1a202c', fontWeight: 600 }}>
            📋 Kỳ Thi Gần Đây
          </h3>
          <button
            onClick={() => navigate('/admin/exams')}
            style={{
              background: 'none',
              border: 'none',
              color: '#3182ce',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Xem tất cả →
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#718096' }}>
            Đang tải...
          </div>
        ) : recentExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#718096' }}>
            Chưa có kỳ thi nào.
            <button
              onClick={() => navigate('/admin/exams/create')}
              style={{
                background: 'none',
                border: 'none',
                color: '#3182ce',
                cursor: 'pointer',
                fontWeight: 500,
                marginLeft: 8,
              }}
            >
              Tạo kỳ thi mới
            </button>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            {recentExams.map((exam, idx) => {
              const status = getStatusLabel(exam.status);
              const browserMode = getBrowserModeLabel(exam.browserMode);

              return (
                <div
                  key={exam.id}
                  onClick={() => navigate(`/admin/exams/${exam.id}`)}
                  style={{
                    padding: '16px 0',
                    borderBottom: idx < recentExams.length - 1 ? '1px solid #e2e8f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f7fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c', marginBottom: 4 }}>
                      {exam.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#718096' }}>
                      {exam.durationMinutes} phút •
                      {new Date(exam.startTime).toLocaleDateString('vi-VN')}
                    </div>
                  </div>

                  {/* Browser Mode Badge */}
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 500,
                    background: '#f7fafc',
                    color: browserMode.color,
                  }}>
                    {browserMode.icon} {browserMode.text}
                  </div>

                  {/* Status Badge */}
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: status.bg,
                    color: status.color
                  }}>
                    {status.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
