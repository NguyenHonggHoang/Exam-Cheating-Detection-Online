import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const LoginPageNew: React.FC = () => {
  const { loginWithCredentials, loginWithOAuth2, user, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    // Wait a bit to allow logout to complete if redirected from logout
    const timer = setTimeout(() => {
      if (!loading && user) {
        navigate('/dashboard', { replace: true });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      await loginWithCredentials(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại username và password.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleOAuth2Login = () => {
    loginWithOAuth2();
  };

  // Show loading while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎓</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hệ Thống Thi Trực Tuyến
          </h1>
          <p className="text-gray-600">
            Đăng nhập để tiếp tục
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}


        {/* OAuth2 Login Button (Primary) */}
        <button
          type="button"
          onClick={handleOAuth2Login}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg mb-4"
        >
          Đăng nhập với OAuth2
        </button>
        {/* Register Link */}
        <div className="mt-6 text-center text-sm text-gray-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-800 font-semibold">
            Đăng ký ngay
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>© 2025 Exam Cheating Detection System</p>
          <p className="mt-1">Phát hiện gian lận tự động bằng AI</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPageNew;
