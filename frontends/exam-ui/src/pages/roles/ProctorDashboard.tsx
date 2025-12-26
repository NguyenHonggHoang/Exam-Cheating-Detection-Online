import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { examsApi, type Exam } from '@/api/exams';
import { sessionsApi } from '@/api/sessions';
import { incidentsApi, type Incident, type IncidentSummary } from '@/api/incidents';
import useIncidentSSE from '@/lib/hooks/useIncidentSSE';

interface DashboardStats {
  activeExams: number;
  pendingViolations: number;
  activeStudents: number;
  warnings: number;
}

const ProctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    activeExams: 0,
    pendingViolations: 0,
    activeStudents: 0,
    warnings: 0
  });
  const [recentViolations, setRecentViolations] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      // Load active exams
      const exams = await examsApi.getAll('ACTIVE').catch(() => []);

      // Load incident summary
      const summary = await incidentsApi.getSummary({}).catch(() => ({
        pendingIncidents: 0,
        totalIncidents: 0,
        highSeverityCount: 0
      }));

      // Load recent incidents
      const incidentsData = await incidentsApi.list({
        status: 'PENDING',
        size: 5
      }).catch(() => ({ content: [] }));

      // Count active sessions across all exams
      let totalActiveSessions = 0;
      for (const exam of exams.slice(0, 5)) { // Limit to 5 exams for performance
        try {
          const sessions = await sessionsApi.getByExam(exam.id, 'ACTIVE');
          totalActiveSessions += sessions.length;
        } catch {
          // Ignore errors
        }
      }

      setStats({
        activeExams: exams.length,
        pendingViolations: summary.pendingIncidents || 0,
        activeStudents: totalActiveSessions,
        warnings: summary.highSeverityCount || 0
      });

      setRecentViolations(incidentsData.content || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // SSE Real-time updates
  useIncidentSSE({
    onNewIncident: (incident) => {
      // Update stats
      setStats(prev => ({
        ...prev,
        pendingViolations: prev.pendingViolations + 1,
        warnings: incident.severity === 'HIGH' ? prev.warnings + 1 : prev.warnings
      }));

      // Update recent violations list
      setRecentViolations(prev => [incident, ...prev].slice(0, 5));
    }
  });

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'MULTIPLE_FACES': 'Nhiều khuôn mặt',
      'NO_FACE': 'Không thấy mặt',
      'LOOKING_AWAY': 'Nhìn ra ngoài',
      'TAB_SWITCH': 'Chuyển tab',
      'PASTE': 'Paste văn bản'
    };
    return labels[type] || type;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32,
            border: '3px solid #e2e8f0',
            borderTopColor: '#3182ce',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#718096' }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 24, color: '#1a202c' }}>
          Chào giám thị {user?.username || 'Proctor'}! 👨‍🏫
        </h2>
        <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>
          Bảng điều khiển giám sát thi cử
        </p>
      </div>

      {/* Quick Stats - Real Data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3182ce',
          cursor: 'pointer'
        }} onClick={() => navigate('/proctor/active-exams')}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3182ce', marginBottom: 4 }}>
            {stats.activeExams}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Kỳ thi đang mở</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #e53e3e',
          cursor: 'pointer'
        }} onClick={() => navigate('/proctor/violations')}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e53e3e', marginBottom: 4 }}>
            {stats.pendingViolations}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Vi phạm chưa duyệt</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #38a169'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#38a169', marginBottom: 4 }}>
            {stats.activeStudents}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Thí sinh đang thi</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #d69e2e',
          cursor: 'pointer'
        }} onClick={() => navigate('/proctor/violations')}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d69e2e', marginBottom: 4 }}>
            {stats.warnings}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Cảnh báo cần xem</div>
        </div>
      </div>

      {/* Recent Violations - Real Data */}
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#1a202c' }}>
            Vi phạm gần đây
          </h3>
          <button
            onClick={() => navigate('/proctor/violations')}
            style={{
              padding: '6px 12px',
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 13,
              color: '#3182ce',
              cursor: 'pointer'
            }}
          >
            Xem tất cả →
          </button>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0' }}>
          {recentViolations.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#718096' }}>
              Không có vi phạm nào cần duyệt
            </div>
          ) : (
            recentViolations.map((violation, idx) => (
              <div key={violation.id} style={{
                padding: '12px 0',
                borderBottom: idx < recentViolations.length - 1 ? '1px solid #e2e8f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>
                    Session: {violation.sessionId.substring(0, 8)}...
                  </div>
                  <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                    {getTypeLabel(violation.type)} • {formatTime(violation.detectedAt)}
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  background: violation.status === 'PENDING' ? '#fef5e7' : '#e8f5e9',
                  color: violation.status === 'PENDING' ? '#d69e2e' : '#38a169'
                }}>
                  {violation.status === 'PENDING' ? 'Chờ duyệt' : 'Đã xác nhận'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
          onClick={() => navigate('/proctor/violations')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1a202c' }}>Duyệt vi phạm</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
            Xem và xác nhận các vi phạm
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
          onClick={() => navigate('/proctor/active-exams')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📹</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1a202c' }}>Giám sát trực tiếp</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
            Theo dõi thí sinh real-time
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
          onClick={() => navigate('/proctor/reports')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1a202c' }}>Báo cáo</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
            Thống kê kỳ thi
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProctorDashboard;
