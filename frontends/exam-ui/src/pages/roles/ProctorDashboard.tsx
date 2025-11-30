import React from 'react';
import { useAuth } from '../../auth/AuthContext';

const ProctorDashboard: React.FC = () => {
  const { user } = useAuth();

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
          Chào giám thị {user?.username}! 👨‍🏫
        </h2>
        <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>
          Bảng điều khiển giám sát thi cử
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3182ce'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3182ce', marginBottom: 4 }}>
            2
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Kỳ thi đang mở</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #e53e3e'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e53e3e', marginBottom: 4 }}>
            15
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
            45
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Thí sinh đang thi</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #d69e2e'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d69e2e', marginBottom: 4 }}>
            8
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Cảnh báo cần xem</div>
        </div>
      </div>

      {/* Recent Violations */}
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1a202c' }}>
          Vi phạm gần đây
        </h3>
        <div style={{ borderTop: '1px solid #e2e8f0' }}>
          {[
            { id: 1, student: 'Nguyễn Văn A', type: 'TAB_SWITCH', time: '10:30', status: 'OPEN' },
            { id: 2, student: 'Trần Thị B', type: 'MULTI_FACE', time: '10:25', status: 'OPEN' },
            { id: 3, student: 'Lê Văn C', type: 'NO_FACE', time: '10:20', status: 'CONFIRMED' },
          ].map((violation, idx) => (
            <div key={violation.id} style={{
              padding: '12px 0',
              borderBottom: idx < 2 ? '1px solid #e2e8f0' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>
                  {violation.student}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                  {violation.type} • {violation.time}
                </div>
              </div>
              <div style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: violation.status === 'OPEN' ? '#fef5e7' : '#e8f5e9',
                color: violation.status === 'OPEN' ? '#d69e2e' : '#38a169'
              }}>
                {violation.status === 'OPEN' ? 'Chờ duyệt' : 'Đã xác nhận'}
              </div>
            </div>
          ))}
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
