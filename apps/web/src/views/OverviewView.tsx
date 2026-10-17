import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api.js';
import { Shield, AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Lock, RefreshCw, FileText } from 'lucide-react';

interface OverviewMetrics {
  pendingRequests: number;
  awaitingExecution: number;
  confirmedTransfers: number;
  rejectedTransfers: number;
  activeHolds: number;
  activePolicies: number;
  securityIncidents: number;
  reconciliationDiscrepancies: number;
}

interface OverviewViewProps {
  onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    const res = await ApiClient.getOverview();
    if (res.error) {
      setError(res.error);
    } else if (res.data?.metrics) {
      setMetrics(res.data.metrics);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Security & Authorization Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Authoritative Canton DevNet transaction authorization metrics and active containment status.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchOverview} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('transfers')}>
            <ArrowUpRight size={14} />
            New Transfer Request
          </button>
        </div>
      </div>

      {error && (
        <div className="banner-alert danger" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {metrics && metrics.activeHolds > 0 && (
        <div className="banner-alert danger" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Lock size={20} />
            <div>
              <strong>EMERGENCY CONTAINMENT ACTIVE</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                {metrics.activeHolds} active emergency hold(s) currently blocking unauthorized disbursements.
              </div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => onNavigate('emergency')}>
            View Containment
          </button>
        </div>
      )}

      <div className="grid-metrics">
        <div className="metric-card">
          <span className="metric-label">Pending Authorizations</span>
          <span className="metric-value">{metrics ? metrics.pendingRequests : '—'}</span>
          <span className="metric-subtext">Requests awaiting dual approvals</span>
        </div>

        <div className="metric-card warning">
          <span className="metric-label">Awaiting Execution</span>
          <span className="metric-value">{metrics ? metrics.awaitingExecution : '—'}</span>
          <span className="metric-subtext">Fully approved, ready for Canton ledger</span>
        </div>

        <div className="metric-card success">
          <span className="metric-label">Confirmed Transfers</span>
          <span className="metric-value">{metrics ? metrics.confirmedTransfers : '—'}</span>
          <span className="metric-subtext">Finalized with cryptographic proof</span>
        </div>

        <div className="metric-card danger">
          <span className="metric-label">Active Emergency Holds</span>
          <span className="metric-value">{metrics ? metrics.activeHolds : '—'}</span>
          <span className="metric-subtext">Mandates under protective halt</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Firewall Enforcement Status</h3>
            <Shield size={18} color="var(--primary-light)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Self-Approval Guard</span>
              <span className="badge badge-confirmed">ACTIVE (Daml Enforced)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Separation of Duties</span>
              <span className="badge badge-confirmed">STRICT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ACS Discrepancies</span>
              <span className={`badge ${metrics && metrics.reconciliationDiscrepancies > 0 ? 'badge-rejected' : 'badge-confirmed'}`}>
                {metrics ? `${metrics.reconciliationDiscrepancies} Detected` : '0 Detected'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monetary Precision Engine</span>
              <span className="badge badge-approved">INTEGER SUB-UNIT (Zero Float)</span>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Security Action Shortcuts</h3>
            <Clock size={18} color="var(--info)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-outline" style={{ justifyContent: 'flex-start' }} onClick={() => onNavigate('approvals')}>
              <CheckCircle2 size={16} color="var(--info)" />
              <span>Review Pending Approvals Queue</span>
            </button>
            <button className="btn btn-outline" style={{ justifyContent: 'flex-start' }} onClick={() => onNavigate('emergency')}>
              <Lock size={16} color="var(--danger)" />
              <span>Declare Emergency Hold / Containment</span>
            </button>
            <button className="btn btn-outline" style={{ justifyContent: 'flex-start' }} onClick={() => onNavigate('evidence')}>
              <FileText size={16} color="var(--primary-light)" />
              <span>Inspect Cryptographic Transaction Evidence</span>
            </button>
          </div>
        </div>
      </div>

      {metrics && metrics.pendingRequests === 0 && metrics.confirmedTransfers === 0 && metrics.awaitingExecution === 0 && (
        <div className="empty-state">
          <Shield className="empty-icon" />
          <div className="empty-title">Initial Clean State: No Active Transactions</div>
          <div className="empty-description">
            MandateGuard starts with authoritative empty state. No synthetic balances or fabricated transactions are ever loaded. Use the Transfer Request Workbench to create your first protected institutional request.
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => onNavigate('transfers')}>
            Open Transfer Workbench
          </button>
        </div>
      )}
    </div>
  );
};
