import React, { useEffect, useState } from 'react';
import { ApiClient, AVAILABLE_USERS } from '../api.js';
import { Server, Activity, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

export const SystemHealthView: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    const res = await ApiClient.getHealth();
    if (res.data) {
      setHealthData(res.data);
    }
    setLoading(false);
  };

  const handleReconcile = async () => {
    setReconciling(true);
    const res = await ApiClient.reconcile();
    if (res.data) {
      setReconcileResult(res.data);
    }
    setReconciling(false);
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 6000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = healthData?.ledger?.connected;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>System Health & Canton Participant Status</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Real-time participant connectivity telemetry, Active Contract Set (ACS) synchronization, and party topology.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Check Health
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleReconcile} disabled={reconciling}>
            <Activity size={14} className={reconciling ? 'animate-spin' : ''} />
            Reconcile with Authoritative ACS
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ borderLeft: `3px solid ${isConnected ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="metric-label">Canton Participant Node</span>
            <Server size={18} color={isConnected ? 'var(--success)' : 'var(--danger)'} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: isConnected ? 'var(--success)' : 'var(--danger)' }}>
            {isConnected ? 'ONLINE / CONNECTED' : 'OFFLINE / UNREACHABLE'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
            Endpoint: {healthData?.ledger?.participantUrl || 'DevNet Participant Node'}
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="metric-label">Ledger API Latency</span>
            <Activity size={18} color="var(--info)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {healthData?.ledger?.latencyMs ? `${healthData.ledger.latencyMs} ms` : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
            Round-trip gRPC/JSON Ledger API ping
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="metric-label">ACS Reconciliation</span>
            <ShieldCheck size={18} color="var(--primary-light)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {reconcileResult ? `${reconcileResult.discrepancies.length} Discrepancies` : 'Synchronized'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
            Authoritative Daml contract validation
          </div>
        </div>
      </div>

      {reconcileResult && (
        <div className="banner-alert" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={20} color="var(--success)" />
          <div>
            <strong>ACS Reconciliation Completed</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verified {reconcileResult.reconciledCount} contracts on Canton Ledger API. {reconcileResult.discrepancies.length} state discrepancies detected.
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Logical Role & Canton Party Mapping</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Server-side authenticated identities mapped to authorized Canton parties. Browser client never directly holds Canton signing keys.
        </p>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Institutional Logical Role</th>
                <th>Canton Party ID</th>
                <th>Separation of Duties Policy</th>
              </tr>
            </thead>
            <tbody>
              {AVAILABLE_USERS.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.label}</td>
                  <td>
                    <span className="badge badge-approved" style={{ fontSize: '0.725rem' }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-accent)' }}>{u.party}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {u.role === 'TransactionInitiator' && 'Cannot approve self-created transfers'}
                    {u.role === 'TransactionApprover' && 'Cannot initiate transfer requests'}
                    {u.role === 'SecurityOperator' && 'Can declare and approve emergency containment'}
                    {u.role === 'TreasuryController' && 'Can propose policy revisions and asset registrations'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
