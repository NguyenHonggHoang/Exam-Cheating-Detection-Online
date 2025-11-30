import React, { useState } from 'react';
import { api } from '../lib/api';

interface Incident {
  id: string;
  sessionId: string;
  ts: number;
  type: string;
  score?: number;
  reason?: string;
  evidenceUrl?: string;
  status: string;
  createdAt: string;
}

const IncidentsPage: React.FC = () => {
  const [sessionId, setSessionId] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    if (!sessionId) { setStatus('Nhập sessionId trước'); return; }
    setStatus('Đang tải...');
    try {
      const res = await api.get(`/incidents?sessionId=${sessionId}`);
      setIncidents(res.data);
      setStatus(`Tìm thấy ${res.data.length} incident(s)`);
    } catch (e: any) {
      setStatus('Lỗi: ' + (e.response?.status || e.message));
    }
  };

  return (
    <div>
      <h2>Incidents</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Session ID
          <input value={sessionId} onChange={e => setSessionId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <button onClick={load}>Load incidents</button>
        <div>Trạng thái: {status}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Type</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Ts</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Score</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map(i => (
              <tr key={i.id}>
                <td>{i.type}</td>
                <td>{i.ts}</td>
                <td>{i.score ?? '-'}</td>
                <td>{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IncidentsPage;
