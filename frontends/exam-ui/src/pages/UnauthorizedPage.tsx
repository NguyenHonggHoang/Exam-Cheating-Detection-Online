import React from 'react';

const UnauthorizedPage: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui',
      background: '#f7fafc'
    }}>
      <div style={{
        textAlign: 'center',
        padding: 48
      }}>
        <div style={{ fontSize: 80, marginBottom: 24 }}>🚫</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a202c', marginBottom: 16 }}>
          Không có quyền truy cập
        </h1>
        <p style={{ fontSize: 16, color: '#718096', marginBottom: 32 }}>
          Bạn không có quyền truy cập trang này
        </p>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#3182ce',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 8,
            fontWeight: 600
          }}
        >
          Về trang chủ
        </a>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
