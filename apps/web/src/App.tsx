import React, { useState, useEffect } from 'react';
import { ApiClient, AVAILABLE_USERS } from './api.js';
import {
  Shield,
  LayoutDashboard,
  ArrowUpRight,
  CheckCircle2,
  Sliders,
  Users,
  AlertOctagon,
  FileText,
  Activity,
  Lock,
} from 'lucide-react';
import { OverviewView } from './views/OverviewView.js';
import { TransferWorkbenchView } from './views/TransferWorkbenchView.js';
import { ApprovalConsoleView } from './views/ApprovalConsoleView.js';
import { PolicyAdminView } from './views/PolicyAdminView.js';
import { BeneficiaryRegistryView } from './views/BeneficiaryRegistryView.js';
import { EmergencyConsoleView } from './views/EmergencyConsoleView.js';
import { EvidenceExplorerView } from './views/EvidenceExplorerView.js';
import { SystemHealthView } from './views/SystemHealthView.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUser, setCurrentUser] = useState(AVAILABLE_USERS[0].id);
  const [ledgerOnline, setLedgerOnline] = useState<boolean | null>(null);
  const [hasActiveHold, setHasActiveHold] = useState(false);

  const checkStatus = async () => {
    const health = await ApiClient.getHealth();
    setLedgerOnline(health.data?.ledger?.connected ?? false);

    const holds = await ApiClient.getHolds();
    setHasActiveHold((holds.data?.holds?.length ?? 0) > 0);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUserChange = (userId: string) => {
    setCurrentUser(userId);
    ApiClient.setCurrentUser(userId);
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="brand-title">MandateGuard</span>
              <span className="brand-subtitle">Canton DevNet</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
              Institutional Digital-Asset Mandate Firewall & Transaction Control Plane
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {/* Active Emergency Hold Alert Pill */}
          {hasActiveHold && (
            <div
              className="ledger-beacon beacon-offline"
              style={{ cursor: 'pointer', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveTab('emergency')}
            >
              <Lock size={12} />
              <span>HOLD ACTIVE</span>
            </div>
          )}

          {/* Ledger Connectivity Beacon */}
          <div className={`ledger-beacon ${ledgerOnline ? 'beacon-online' : 'beacon-offline'}`}>
            <span className="beacon-dot"></span>
            <span>{ledgerOnline ? 'Canton Live' : 'Ledger Offline'}</span>
          </div>

          {/* User Role Switcher */}
          <div className="role-badge-container">
            <span className="role-label">Actor:</span>
            <select
              id="role-switcher-select"
              className="role-select"
              value={currentUser}
              onChange={(e) => handleUserChange(e.target.value)}
            >
              {AVAILABLE_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} [{u.party}]
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Operations Navigation Tabs */}
      <nav className="sub-nav">
        <button
          id="tab-overview"
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={15} />
          <span>Security Overview</span>
        </button>

        <button
          id="tab-transfers"
          className={`nav-tab ${activeTab === 'transfers' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfers')}
        >
          <ArrowUpRight size={15} />
          <span>Transfer Workbench</span>
        </button>

        <button
          id="tab-approvals"
          className={`nav-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          <CheckCircle2 size={15} />
          <span>Approval Console</span>
        </button>

        <button
          id="tab-policies"
          className={`nav-tab ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <Sliders size={15} />
          <span>Policy Governance</span>
        </button>

        <button
          id="tab-beneficiaries"
          className={`nav-tab ${activeTab === 'beneficiaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('beneficiaries')}
        >
          <Users size={15} />
          <span>Beneficiary Registry</span>
        </button>

        <button
          id="tab-emergency"
          className={`nav-tab ${activeTab === 'emergency' ? 'active' : ''}`}
          onClick={() => setActiveTab('emergency')}
        >
          <AlertOctagon size={15} />
          <span>Emergency Response</span>
        </button>

        <button
          id="tab-evidence"
          className={`nav-tab ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidence')}
        >
          <FileText size={15} />
          <span>Evidence Explorer</span>
        </button>

        <button
          id="tab-health"
          className={`nav-tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <Activity size={15} />
          <span>System Health</span>
        </button>
      </nav>

      {/* Main Content Body */}
      <main className="main-content">
        {activeTab === 'overview' && <OverviewView onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'transfers' && <TransferWorkbenchView onSuccess={() => setActiveTab('approvals')} />}
        {activeTab === 'approvals' && <ApprovalConsoleView />}
        {activeTab === 'policies' && <PolicyAdminView />}
        {activeTab === 'beneficiaries' && <BeneficiaryRegistryView />}
        {activeTab === 'emergency' && <EmergencyConsoleView />}
        {activeTab === 'evidence' && <EvidenceExplorerView />}
        {activeTab === 'health' && <SystemHealthView />}
      </main>
    </div>
  );
};
