import React, { useState } from 'react';
import { api, tinyPngBase64 } from '../lib/api';

const IngestDemoPage: React.FC = () => {
  const [sessionId, setSessionId] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (m: string) => setLog(l => [m, ...l.slice(0, 50)]);

  const ingestEvent = async () => {
    if (!sessionId) return pushLog('Chưa nhập sessionId');
    try {
      const ts = Date.now();
      const payload = {
        items: [
          { sessionId, ts, eventType: 'FOCUS', details: '{"demo":"focus"}', idempotencyKey: 'evt-' + ts }
        ]
      };
      const res = await api.post('/ingest/events', payload);
      pushLog('Event OK: created=' + res.data.created);
    } catch (e: any) {
      pushLog('Event lỗi: ' + (e.response?.status || e.message));
    }
  };

  const ingestSnapshotMeta = async () => {
    if (!sessionId) return pushLog('Chưa nhập sessionId');
    try {
      const ts = Date.now();
      const payload = {
        items: [
          { sessionId, ts, objectKey: `uploads/${sessionId}/${new Date().toISOString()}/meta-${ts}.jpg`, fileSize: 123, mimeType: 'image/jpeg', faceCount: 0, idempotencyKey: 'snap-' + ts }
        ]
      };
      const res = await api.post('/ingest/snapshots', payload);
      pushLog('Snapshot meta OK: created=' + res.data.created);
    } catch (e: any) {
      pushLog('Snapshot meta lỗi: ' + (e.response?.status || e.message));
    }
  };

  const uploadSnapshot = async () => {
    if (!sessionId) return pushLog('Chưa nhập sessionId');
    try {
      const ts = Date.now();
      const payload = {
        items: [
          { sessionId, ts, imageBase64: tinyPngBase64(), faceCount: 0, idempotencyKey: 'up-' + ts }
        ]
      };
      const res = await api.post('/ingest/snapshots/upload', payload);
      pushLog('Upload snapshot OK: created=' + res.data.created);
    } catch (e: any) {
      pushLog('Upload snapshot lỗi: ' + (e.response?.status || e.message));
    }
  };

  return (
    <div>
      <h2>Ingest Demo</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Session ID
          <input value={sessionId} onChange={e => setSessionId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={ingestEvent}>Ingest Event</button>
          <button onClick={ingestSnapshotMeta}>Ingest Snapshot Metadata</button>
          <button onClick={uploadSnapshot}>Upload Snapshot</button>
        </div>
        <div>
          <h4>Log</h4>
          <ul>
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IngestDemoPage;
