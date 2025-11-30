import React, { useState } from 'react';
import { api } from '../lib/api';

const seededExam = '11111111-1111-1111-1111-111111111111';
const seededUser = '22222222-2222-2222-2222-222222222222';

const StartSessionPage: React.FC = () => {
  const [examId, setExamId] = useState(seededExam);
  const [userId, setUserId] = useState(seededUser);
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const start = async () => {
    setStatus('Đang tạo session...');
    try {
      const res = await api.post('/sessions/start', { examId, userId });
      setSessionId(res.data.id);
      setStatus('Tạo session thành công');
    } catch (e: any) {
      setStatus('Lỗi: ' + (e.response?.data?.title || e.message));
    }
  };

  const end = async () => {
    if (!sessionId) return;
    setStatus('Đang kết thúc session...');
    try {
      const res = await api.post(`/sessions/${sessionId}/end`);
      setStatus('Đã kết thúc');
    } catch (e: any) {
      setStatus('Lỗi: ' + (e.response?.data?.title || e.message));
    }
  };

  return (
    <div>
      <h2>Bắt đầu phiên thi</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Exam ID
          <input value={examId} onChange={e => setExamId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          User ID
          <input value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={start}>Start session</button>
          <button onClick={end} disabled={!sessionId}>End session</button>
        </div>
        <div>Session ID: <code>{sessionId || '(chưa có)'}</code></div>
        <div>Trạng thái: {status}</div>
      </div>
    </div>
  );
};

export default StartSessionPage;
