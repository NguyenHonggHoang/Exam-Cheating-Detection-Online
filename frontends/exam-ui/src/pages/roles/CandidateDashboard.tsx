import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { examsApi, type Exam } from '@/api/exams';
import { sessionsApi, type Session } from '@/api/sessions';
import { incidentsApi } from '@/api/incidents';

interface DashboardStats {
  availableExams: number;
  completedExams: number;
  totalViolations: number;
  loading: boolean;
}

const CandidateDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    availableExams: 0,
    completedExams: 0,
    totalViolations: 0,
    loading: true
  });

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) {
      console.log('[Dashboard] No user, skipping stats load');
      return;
    }

    console.log('[Dashboard] Loading stats for user:', user.id);

    try {
      // Load available exams
      const allExams = await examsApi.getAll();
      console.log('[Dashboard] All exams:', allExams);

      // Count all exams - consider an exam available if it's not in the past
      // For simplicity, just count all exams that exist
      const availableExams = allExams || [];
      console.log('[Dashboard] Available exams count:', availableExams.length);

      // Load user sessions
      const sessions = await sessionsApi.getByUser(user.id);
      console.log('[Dashboard] User sessions:', sessions);
      const completedSessions = (sessions || []).filter((s: Session) => s.status === 'ENDED');
      console.log('[Dashboard] Completed sessions:', completedSessions.length);

      // Load violations for all sessions
      let totalViolations = 0;
      for (const session of (sessions || [])) {
        try {
          const incidentsPage = await incidentsApi.list({ sessionId: session.id, size: 1000 });
          const count = incidentsPage.totalElements || incidentsPage.content?.length || 0;
          console.log(`[Dashboard] Session ${session.id}: ${count} incidents`);
          totalViolations += count;
        } catch (err) {
          console.error(`[Dashboard] Error loading incidents for session ${session.id}:`, err);
        }
      }
      console.log('[Dashboard] Total violations:', totalViolations);

      setStats({
        availableExams: availableExams.length,
        completedExams: completedSessions.length,
        totalViolations,
        loading: false
      });
    } catch (err) {
      console.error('[Dashboard] Error loading stats:', err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

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
          Xin chào, {user?.username || user?.id || 'Ẩn danh'}! 👋
        </h2>
        <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>
          Chào mừng bạn đến với hệ thống thi trực tuyến
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3182ce'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3182ce', marginBottom: 4 }}>
            {stats.loading ? '...' : stats.availableExams}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Kỳ thi khả dụng</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #38a169'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#38a169', marginBottom: 4 }}>
            {stats.loading ? '...' : stats.completedExams}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Đã hoàn thành</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #e53e3e'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e53e3e', marginBottom: 4 }}>
            {stats.loading ? '...' : stats.totalViolations}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Vi phạm</div>
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
          onClick={() => navigate('/candidate/exams')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1a202c' }}>Xem kỳ thi</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>
            Danh sách các kỳ thi bạn có thể tham gia
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
          onClick={() => navigate('/candidate/my-results')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1a202c' }}>Kết quả của tôi</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>
            Xem điểm số và kết quả các kỳ thi đã tham gia
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
          onClick={() => navigate('/candidate/my-violations')}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1a202c' }}>Vi phạm của tôi</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>
            Xem các cảnh báo vi phạm (nếu có)
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
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#1a202c' }}>Hướng dẫn</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>
            Cách sử dụng hệ thống và quy định thi
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
