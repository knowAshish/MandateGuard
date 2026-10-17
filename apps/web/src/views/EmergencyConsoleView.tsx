import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api.js';
import { Lock, Unlock, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export const EmergencyConsoleView: React.FC = () => {
  const [holds, setHolds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnactModal, setShowEnactModal] = useState(false);
  const [scope, setScope] = useState<'Global' | 'Asset' | 'Mandate' | 'Beneficiary'>('Global');
  const [reason, setReason] = useState('Anomalous transfer activity detected by security monitor');
  const [releaseConditions, setReleaseConditions] = useState('Comprehensive cryptographic audit and multi-signature authorization');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchHolds = async () => {
    setLoading(true);
    const res = await ApiClient.getHolds();
    if (res.data?.holds) {
      setHolds(res.data.holds);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHolds();
    const interval = setInterval(fetchHolds, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleEnactHold = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const payload = {
      scope,
      reason,
      releaseConditions,
    };

    const res = await ApiClient.createHold(payload);
    if (res.error) {
      setStatusMessage({ text: `${res.error} ${res.ledgerError ? `[Ledger: ${res.ledgerError}]` : ''}`, type: 'error' });
    } else {
      setStatusMessage({ text: `Emergency Hold enacted on Canton Ledger. Hold ID: ${res.data?.hold?.holdId || 'Recorded'}. Dual containment active.`, type: 'success' });
      setShowEnactModal(false);
      await fetchHolds();
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Emergency Response & Containment Console</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Authoritative circuit breaker mechanism to freeze institutional disbursements upon suspected compromise.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchHolds} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowEnactModal(true)}>
            <Lock size={14} />
            Declare Emergency Hold
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`banner-alert ${statusMessage.type === 'error' ? 'danger' : 'success'}`} style={{ marginBottom: '1.5rem' }}>
          {statusMessage.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="metric-label">Active Emergency Holds</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: holds.length > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {holds.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {holds.length > 0 ? 'Disbursements currently frozen' : 'No active containment holds'}
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div className="metric-label">Dual-Control Requirement</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>2 Signatures</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Security Operator + Secondary Approver</div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="metric-label">Enforcement Engine</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success)' }}>Daml Choice</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Evaluated at choice exercise time</div>
        </div>
      </div>

      <div className="glass-panel">
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Active Containment Inventory</h3>

        {holds.length === 0 ? (
          <div className="empty-state">
            <Unlock className="empty-icon" color="var(--success)" />
            <div className="empty-title">Clean Operational Status</div>
            <div className="empty-description">
              No emergency holds are currently active on the Canton ledger. Institutional disbursements are proceeding under standard dual-control policy rules.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {holds.map((hold) => (
              <div key={hold.holdId} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldAlert size={18} color="var(--danger)" />
                      <span className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 700 }}>{hold.holdId}</span>
                      <span className="badge badge-rejected">{hold.state}</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Scope: <strong>{hold.scope}</strong> • Initiated By: {hold.holdInitiator} • Effective From: {new Date(hold.effectiveFrom).toLocaleString()}
                    </div>
                  </div>

                  <button className="btn btn-outline btn-sm" onClick={() => setStatusMessage({ text: 'Hold release requires dual-key multi-signature confirmation on Canton ledger.', type: 'error' })}>
                    <Unlock size={14} />
                    Request Controlled Release
                  </button>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', marginTop: '0.75rem' }}>
                  <div><strong>Declared Reason:</strong> {hold.reason}</div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}><strong>Release Conditions:</strong> {hold.releaseConditions}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEnactModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleEnactHold} className="glass-panel" style={{ width: '520px', background: 'var(--bg-secondary)', border: '1px solid var(--danger-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Lock size={20} color="var(--danger)" />
              <h3 style={{ color: 'var(--danger)' }}>Declare Emergency Containment Hold</h3>
            </div>

            <div className="form-group">
              <label className="form-label">Containment Scope</label>
              <select className="form-select" value={scope} onChange={(e) => setScope(e.target.value as any)}>
                <option value="Global">Global (All Institutional Mandates)</option>
                <option value="Asset">Asset Specific</option>
                <option value="Mandate">Mandate Specific (MANDATE-PRIMARY)</option>
                <option value="Beneficiary">Beneficiary Counterparty Specific</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Justification / Incident Reason</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mandatory Release Conditions</label>
              <input
                type="text"
                className="form-input"
                value={releaseConditions}
                onChange={(e) => setReleaseConditions(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowEnactModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                Execute Emergency Hold On-Ledger
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
