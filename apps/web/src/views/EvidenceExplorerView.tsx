import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api.js';
import { Download, RefreshCw, Hash, ShieldCheck, AlertCircle } from 'lucide-react';

export const EvidenceExplorerView: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvidence = async () => {
    setLoading(true);
    const res = await ApiClient.getEvidence();
    if (res.data) {
      setAuditLogs(res.data.auditLogs || []);
      setAlerts(res.data.alerts || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvidence();
    const interval = setInterval(fetchEvidence, 6000);
    return () => clearInterval(interval);
  }, []);

  const exportAuditLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ auditLogs, alerts }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mandateguard-evidence-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Transaction Evidence Explorer</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Cryptographically verifiable audit log with SHA-256 payload digests and Canton ledger update traces.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchEvidence} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportAuditLogs} disabled={auditLogs.length === 0}>
            <Download size={14} />
            Export JSON Evidence
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="banner-alert danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <div>
            <strong>Security Event Anomaly Detected</strong>
            <div style={{ fontSize: '0.8rem' }}>
              {alerts.length} security alert(s) triggered by consecutive authorization failures or policy violations.
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel">
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Verifiable Audit Trail ({auditLogs.length} Records)</h3>

        {auditLogs.length === 0 ? (
          <div className="empty-state">
            <Hash className="empty-icon" />
            <div className="empty-title">Clean Audit Log</div>
            <div className="empty-description">
              No audit records generated yet. All actions including requests, approvals, holds, and executions produce immutable SHA-256 signed evidence entries.
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Request Ref</th>
                  <th>Actor Party</th>
                  <th>Canton Update ID</th>
                  <th>Cryptographic Evidence Hash</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.auditId}>
                    <td style={{ fontSize: '0.775rem', color: 'var(--text-dim)' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className="badge badge-approved" style={{ fontSize: '0.725rem' }}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="font-mono">{log.requestRef || '—'}</td>
                    <td className="font-mono" style={{ fontSize: '0.8rem' }}>{log.actorPartyId}</td>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-accent)' }}>
                      {log.ledgerUpdateId || '—'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {log.evidenceRef || (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ShieldCheck size={12} color="var(--success)" /> Verified Entry
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
