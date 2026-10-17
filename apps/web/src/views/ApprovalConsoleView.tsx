import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api.js';
import { CheckCircle2, XCircle, Play, AlertTriangle, ShieldAlert, UserCheck, Shield } from 'lucide-react';

export const ApprovalConsoleView: React.FC = () => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [approvalReasons, setApprovalReasons] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const currentUserId = ApiClient.getCurrentUser();

  const fetchTransfers = async () => {
    setLoading(true);
    const res = await ApiClient.getTransfers();
    if (res.data?.requests) {
      setTransfers(res.data.requests);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (requestRef: string) => {
    setActionInProgress(requestRef);
    setStatusMessage(null);
    const reason = approvalReasons[requestRef] || 'Mandate verified by authorized controller';

    const res = await ApiClient.approveTransfer(requestRef, 'Approve', reason);
    if (res.error) {
      setStatusMessage({ text: `${res.error} ${res.ledgerError ? `[Ledger: ${res.ledgerError}]` : ''}`, type: 'error' });
    } else {
      setStatusMessage({ text: `Approval submitted successfully for request ${requestRef}.`, type: 'success' });
      await fetchTransfers();
    }
    setActionInProgress(null);
  };

  const handleReject = async (requestRef: string) => {
    setActionInProgress(requestRef);
    setStatusMessage(null);
    const reason = approvalReasons[requestRef] || 'Rejected by approver';

    const res = await ApiClient.approveTransfer(requestRef, 'Reject', reason);
    if (res.error) {
      setStatusMessage({ text: res.error, type: 'error' });
    } else {
      setStatusMessage({ text: `Request ${requestRef} rejected.`, type: 'success' });
      await fetchTransfers();
    }
    setActionInProgress(null);
  };

  const handleExecute = async (requestRef: string) => {
    setActionInProgress(requestRef);
    setStatusMessage(null);

    const res = await ApiClient.executeTransfer(requestRef);
    if (res.error) {
      setStatusMessage({ text: res.error, type: 'error' });
    } else {
      setStatusMessage({ text: `Transfer ${requestRef} executed on Canton Ledger! Update ID: ${res.data?.request?.executionUpdateId || 'Confirmed'}`, type: 'success' });
      await fetchTransfers();
    }
    setActionInProgress(null);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Dual-Control Approval Console</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Multi-signature authorization queue enforcing strict separation of duties and self-approval denial.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchTransfers} disabled={loading}>
          Refresh Queue
        </button>
      </div>

      {statusMessage && (
        <div className={`banner-alert ${statusMessage.type === 'error' ? 'danger' : 'success'}`} style={{ marginBottom: '1.5rem' }}>
          {statusMessage.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="empty-state">
          <Shield className="empty-icon" />
          <div className="empty-title">Approval Queue Clean</div>
          <div className="empty-description">
            There are currently no transfer requests awaiting authorization on the Canton participant. New submissions will appear here automatically.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {transfers.map((req) => {
            const isInitiator = (req.initiator === 'Initiator' && currentUserId === 'user_initiator') ||
                                (req.initiator === currentUserId);
            const isApproverRole = currentUserId === 'user_approver1' || currentUserId === 'user_approver2';
            const hasAlreadyApproved = req.currentApprovals?.some((a: string) => a === 'Approver1' && currentUserId === 'user_approver1' || a === 'Approver2' && currentUserId === 'user_approver2');
            const canApprove = isApproverRole && !isInitiator && !hasAlreadyApproved && req.state !== 'Confirmed' && req.state !== 'Rejected';

            return (
              <div key={req.requestRef} className="glass-panel" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {req.requestRef}
                      </span>
                      <span className={`badge badge-${req.state.toLowerCase()}`}>
                        {req.state}
                      </span>
                      {isInitiator && (
                        <span className="badge badge-rejected" style={{ fontSize: '0.7rem' }}>
                          <ShieldAlert size={12} /> You are the Initiator (Self-Approval Disallowed)
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                      Contract ID: <span className="font-mono">{req.contractId || 'Authoritative Contract'}</span> • Created: {new Date(req.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
                      {(Number(req.quantity.amount) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Asset: {req.assetId.assetCode} ({req.quantity.amount} sub-units)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div>
                    <div className="metric-label" style={{ marginBottom: '0.2rem' }}>Beneficiary</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{req.beneficiary.displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{req.beneficiary.registryId}</div>
                  </div>
                  <div>
                    <div className="metric-label" style={{ marginBottom: '0.2rem' }}>Initiating Party</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{req.initiator}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Institution: {req.institution}</div>
                  </div>
                  <div>
                    <div className="metric-label" style={{ marginBottom: '0.2rem' }}>Dual-Control Progress</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {req.currentApprovals?.length || 0} of {req.requiredApprovals} Approvals
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Approvers: {req.currentApprovals?.length > 0 ? req.currentApprovals.join(', ') : 'None yet'}
                    </div>
                  </div>
                </div>

                {req.state !== 'Confirmed' && req.state !== 'Rejected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Mandatory approval audit reason / compliance memo"
                      style={{ flex: 1, minWidth: '260px' }}
                      value={approvalReasons[req.requestRef] || ''}
                      onChange={(e) => setApprovalReasons({ ...approvalReasons, [req.requestRef]: e.target.value })}
                    />

                    {canApprove && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApprove(req.requestRef)}
                        disabled={actionInProgress === req.requestRef}
                      >
                        <UserCheck size={16} />
                        Approve Mandate
                      </button>
                    )}

                    {isInitiator && (
                      <button className="btn btn-outline" disabled title="Initiator cannot approve their own transfer request">
                        Self-Approval Blocked
                      </button>
                    )}

                    {!isApproverRole && !isInitiator && (
                      <button className="btn btn-outline" disabled title="Only designated Approver parties can approve">
                        Role Ineligible to Approve
                      </button>
                    )}

                    {canApprove && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(req.requestRef)}
                        disabled={actionInProgress === req.requestRef}
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    )}

                    {req.state === 'Approved' && (
                      <button
                        className="btn btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success-border)' }}
                        onClick={() => handleExecute(req.requestRef)}
                        disabled={actionInProgress === req.requestRef}
                      >
                        <Play size={16} />
                        Execute On-Ledger
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
