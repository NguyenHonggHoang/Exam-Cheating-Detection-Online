import React from 'react';
import { useAuth } from '../../auth/AuthContext';

const AdminDashboard: React.FC = () => {
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
          Quản trị viên {user?.username} 👑
        </h2>
        <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>
          Bảng điều khiển quản trị hệ thống
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
            12
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng kỳ thi</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #38a169'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#38a169', marginBottom: 4 }}>
            256
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng thí sinh</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #e53e3e'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e53e3e', marginBottom: 4 }}>
            47
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tổng vi phạm</div>
        </div>
        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #d69e2e'
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d69e2e', marginBottom: 4 }}>
            18.4%
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>Tỉ lệ vi phạm</div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1a202c' }}>
            📊 Thống kê vi phạm theo thời gian
          </h3>
          <div style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7fafc',
            borderRadius: 8,
            color: '#a0aec0'
          }}>
            [Biểu đồ sẽ được hiển thị ở đây]
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1a202c' }}>
            📈 Phân bố loại vi phạm
          </h3>
          <div style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7fafc',
            borderRadius: 8,
            color: '#a0aec0'
          }}>
            [Pie chart]
          </div>
        </div>
      </div>

      {/* Recent Exams */}
      <div style={{
        background: 'white',
        padding: 24,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#1a202c' }}>
          Kỳ thi gần đây
        </h3>
        <div style={{ borderTop: '1px solid #e2e8f0' }}>
          {[
            { id: 1, name: 'Giữa kỳ Toán', students: 45, violations: 8, status: 'ENDED' },
            { id: 2, name: 'Cuối kỳ Lý', students: 38, violations: 5, status: 'ACTIVE' },
            { id: 3, name: 'Giữa kỳ Hóa', students: 52, violations: 12, status: 'ACTIVE' },
          ].map((exam, idx) => (
            <div key={exam.id} style={{
              padding: '12px 0',
              borderBottom: idx < 2 ? '1px solid #e2e8f0' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>
                  {exam.name}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                  {exam.students} thí sinh • {exam.violations} vi phạm
                </div>
              </div>
              <div style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: exam.status === 'ACTIVE' ? '#e8f5e9' : '#f5f5f5',
                color: exam.status === 'ACTIVE' ? '#38a169' : '#718096'
              }}>
                {exam.status === 'ACTIVE' ? 'Đang diễn ra' : 'Đã kết thúc'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { icon: '📝', title: 'Tạo kỳ thi', desc: 'Thêm kỳ thi mới' },
          { icon: '📊', title: 'Thống kê', desc: 'Xem báo cáo chi tiết' },
          { icon: '⚠️', title: 'Vi phạm', desc: 'Quản lý tất cả vi phạm' },
          { icon: '⚙️', title: 'Cài đặt', desc: 'Cấu hình hệ thống' }
        ].map((action, idx) => (
          <div key={idx} style={{
            background: 'white',
            padding: 20,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            textAlign: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{action.icon}</div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 14, color: '#1a202c' }}>{action.title}</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>{action.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
