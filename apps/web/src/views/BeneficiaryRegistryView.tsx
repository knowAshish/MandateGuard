import React, { useState } from 'react';
import { Plus, CheckCircle, Ban } from 'lucide-react';

interface BeneficiaryItem {
  registryId: string;
  displayName: string;
  destinationParty: string;
  allowedAssets: string[];
  singleLimit: string;
  coolingOffUntil: string | null;
  status: 'Active' | 'CoolingOff' | 'Revoked';
}

export const BeneficiaryRegistryView: React.FC = () => {
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([
    {
      registryId: 'BEN-VENDOR-01',
      displayName: 'Apex Custody Corp',
      destinationParty: 'VendorApexParty',
      allowedAssets: ['TEST-USD', 'TEST-EUR'],
      singleLimit: '$500,000.00',
      coolingOffUntil: null,
      status: 'Active',
    },
    {
      registryId: 'BEN-VENDOR-02',
      displayName: 'Institutional Liquidity Fund',
      destinationParty: 'LiquidityFundParty',
      allowedAssets: ['TEST-USD', 'TEST-USDC'],
      singleLimit: '$250,000.00',
      coolingOffUntil: null,
      status: 'Active',
    },
    {
      registryId: 'BEN-NEW-ESCROW',
      displayName: 'Prime Escrow Solutions Ltd',
      destinationParty: 'EscrowPrimeParty',
      allowedAssets: ['TEST-USD'],
      singleLimit: '$100,000.00',
      coolingOffUntil: '2026-10-18T12:00:00Z',
      status: 'CoolingOff',
    },
  ]);

  const [notification, setNotification] = useState<string | null>(null);

  const handleRevoke = (id: string) => {
    setBeneficiaries(
      beneficiaries.map((b) => (b.registryId === id ? { ...b, status: 'Revoked' } : b))
    );
    setNotification(`Beneficiary ${id} revoked. All transfer requests to this party will be immediately denied by MandateGuard.`);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Approved Beneficiary Registry</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Whitelisted institutional counterparties with mandatory cooling-off controls and transfer destination enforcement.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNotification('Registration of new counterparty requires multi-signature treasury initiation.')}>
          <Plus size={14} />
          Register New Counterparty
        </button>
      </div>

      {notification && (
        <div className="banner-alert" style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: '#67e8f9', marginBottom: '1.5rem' }}>
          <CheckCircle size={18} />
          <span>{notification}</span>
        </div>
      )}

      <div className="glass-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registry ID</th>
                <th>Counterparty Name</th>
                <th>Canton Destination Party</th>
                <th>Allowed Assets</th>
                <th>Single Limit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => (
                <tr key={b.registryId}>
                  <td className="font-mono">{b.registryId}</td>
                  <td style={{ fontWeight: 600 }}>{b.displayName}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{b.destinationParty}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {b.allowedAssets.map((asset) => (
                        <span key={asset} className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                          {asset}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{b.singleLimit}</td>
                  <td>
                    {b.status === 'Active' && <span className="badge badge-confirmed">Active</span>}
                    {b.status === 'CoolingOff' && <span className="badge badge-pending">Cooling Off</span>}
                    {b.status === 'Revoked' && <span className="badge badge-rejected">Revoked</span>}
                  </td>
                  <td>
                    {b.status !== 'Revoked' && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                        onClick={() => handleRevoke(b.registryId)}
                      >
                        <Ban size={12} />
                        Revoke
                      </button>
                    )}
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
