import React, { useState } from 'react';
import { Sliders, ShieldCheck, Plus, CheckCircle, FileCode } from 'lucide-react';

export const PolicyAdminView: React.FC = () => {
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [singleLimit, setSingleLimit] = useState('100000.00');
  const [dailyLimit, setDailyLimit] = useState('500000.00');
  const [approvalsRequired, setApprovalsRequired] = useState(2);
  const [proposals, setProposals] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault();
    const newProposal = {
      proposalId: `PROP-${Date.now().toString(36).toUpperCase()}`,
      proposedVersion: 2,
      singleTransferLimit: singleLimit,
      dailyVolumeLimit: dailyLimit,
      requiredApprovals: approvalsRequired,
      proposer: 'Amira Patel (TreasuryCtrl)',
      status: 'PendingActivation',
      approvals: ['TreasuryCtrl'],
      createdAt: new Date().toISOString(),
    };
    setProposals([newProposal, ...proposals]);
    setShowProposeModal(false);
    setNotice(`Policy Change Proposal ${newProposal.proposalId} created. Dual-control governance approval required before activation.`);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Policy Administration & Governance</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Version-controlled Daml mandate authorization rules, transfer thresholds, and velocity guards.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowProposeModal(true)}>
          <Plus size={14} />
          Propose Policy Revision
        </button>
      </div>

      {notice && (
        <div className="banner-alert" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: '#6ee7b7', marginBottom: '1.5rem' }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="var(--primary-light)" />
              <h3 style={{ fontSize: '1.1rem' }}>Active Mandate Policy: POLICY-PRIMARY (v1)</h3>
            </div>
            <span className="badge badge-confirmed">ACTIVE ON-LEDGER</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div className="metric-label">Single Transfer Ceiling</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>$100,000.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>10,000,000 integer sub-units</div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div className="metric-label">Rolling Daily Volume Limit</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>$500,000.00</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>50,000,000 integer sub-units</div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div className="metric-label">Required Dual-Control Signatures</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>2 Approvals</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Independent non-initiator approvers</div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div className="metric-label">Self-Approval Prevention</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--success)' }}>Strict Enforced</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Daml precondition check</div>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <FileCode size={18} color="var(--info)" />
            <h3 style={{ fontSize: '1rem' }}>Contractual Template Details</h3>
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p><strong>Package ID:</strong> MandateGuard-0.1.0</p>
            <p><strong>Template:</strong> MandateGuard.Policy:PolicyVersion</p>
            <p><strong>Signatories:</strong> Operator, InstA</p>
            <p><strong>Governance:</strong> Dual-Key Authorization Required for Activation</p>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Policy Revision Proposals Queue</h3>
        {proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No pending policy change proposals. Active policy version 1 is currently in effect.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proposal ID</th>
                  <th>Target Version</th>
                  <th>Single Limit</th>
                  <th>Daily Volume</th>
                  <th>Proposer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.proposalId}>
                    <td className="font-mono">{p.proposalId}</td>
                    <td>Version {p.proposedVersion}</td>
                    <td>${Number(p.singleTransferLimit).toLocaleString()}</td>
                    <td>${Number(p.dailyVolumeLimit).toLocaleString()}</td>
                    <td>{p.proposer}</td>
                    <td>
                      <span className="badge badge-pending">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showProposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handlePropose} className="glass-panel" style={{ width: '480px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Sliders size={20} color="var(--primary-light)" />
              <h3>Propose Policy Revision</h3>
            </div>

            <div className="form-group">
              <label className="form-label">Single Transfer Ceiling ($)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={singleLimit}
                onChange={(e) => setSingleLimit(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Volume Limit ($)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dual-Control Approval Threshold</label>
              <input
                type="number"
                min="1"
                max="5"
                className="form-input"
                value={approvalsRequired}
                onChange={(e) => setApprovalsRequired(Number(e.target.value))}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowProposeModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit Proposal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
