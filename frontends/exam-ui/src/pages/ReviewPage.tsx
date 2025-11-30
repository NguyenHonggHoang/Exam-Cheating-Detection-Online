import React, { useState } from 'react';
import { api } from '../lib/api';

const adminReviewer = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const ReviewPage: React.FC = () => {
  const [incidentId, setIncidentId] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('Looks valid');
  const [created, setCreated] = useState(false);

  const submit = async () => {
    if (!incidentId) { setStatus('Nhập incidentId trước'); return; }
    setStatus('Đang gửi review...');
    try {
      const res = await api.post('/admin/reviews', {
        incidentId,
        reviewerId: adminReviewer,
        status: 'CONFIRMED',
        note
      });
      setCreated(true);
      setStatus('Review OK');
    } catch (e: any) {
      setStatus('Lỗi: ' + (e.response?.status || e.message));
    }
  };

  const load = async () => {
    if (!incidentId) { setStatus('Nhập incidentId trước'); return; }
    setStatus('Đang tải review...');
    try {
      const res = await api.get(`/admin/reviews?incidentId=${incidentId}`);
      setStatus(res.data ? 'Đã có review' : 'Chưa có review');
    } catch (e: any) {
      setStatus('Lỗi: ' + (e.response?.status || e.message));
    }
  };

  return (
    <div>
      <h2>Review Incident</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Incident ID
          <input value={incidentId} onChange={e => setIncidentId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Note
          <input value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit}>Create review</button>
          <button onClick={load}>Load review</button>
        </div>
        <div>Trạng thái: {status}</div>
        <div>Đã tạo: {created ? '✔' : '✘'}</div>
      </div>
    </div>
  );
};

export default ReviewPage;
