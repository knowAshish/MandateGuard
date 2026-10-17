export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  ledgerError?: string;
  status: number;
}

export interface UserRoleInfo {
  id: string;
  label: string;
  role: string;
  party: string;
}

export const AVAILABLE_USERS: UserRoleInfo[] = [
  { id: 'user_initiator', label: 'Sarah Chen (Initiator)', role: 'TransactionInitiator', party: 'Initiator' },
  { id: 'user_approver1', label: 'David Kim (Approver 1)', role: 'TransactionApprover', party: 'Approver1' },
  { id: 'user_approver2', label: 'Elena Rostova (Approver 2)', role: 'TransactionApprover', party: 'Approver2' },
  { id: 'user_secops', label: 'Marcus Vance (SecOps)', role: 'SecurityOperator', party: 'SecOps' },
  { id: 'user_treasury', label: 'Amira Patel (Treasury Ctrl)', role: 'TreasuryController', party: 'TreasuryCtrl' },
];

export class ApiClient {
  private static currentUser = AVAILABLE_USERS[0].id;

  static setCurrentUser(userId: string) {
    this.currentUser = userId;
  }

  static getCurrentUser(): string {
    return this.currentUser;
  }

  static async request<T = any>(
    path: string,
    options: RequestInit = {},
    customHeaders: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': this.currentUser,
      ...customHeaders,
    };

    try {
      const res = await fetch(path, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          status: res.status,
          error: json.error || `Request failed with status ${res.status}`,
          ledgerError: json.ledgerError,
        };
      }

      return {
        status: res.status,
        data: json as T,
      };
    } catch (err) {
      return {
        status: 0,
        error: (err as Error).message || 'Network error connecting to API',
      };
    }
  }

  static getOverview() {
    return this.request('/api/overview');
  }

  static getHealth() {
    return this.request('/health');
  }

  static getTransfers() {
    return this.request('/api/transfers');
  }

  static createTransfer(payload: any, dedupKey?: string) {
    return this.request(
      '/api/transfers',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      dedupKey ? { 'X-Deduplication-Key': dedupKey } : {}
    );
  }

  static approveTransfer(requestRef: string, decision: 'Approve' | 'Reject', reason?: string) {
    return this.request(`/api/transfers/${requestRef}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
  }

  static executeTransfer(requestRef: string) {
    return this.request(`/api/transfers/${requestRef}/execute`, {
      method: 'POST',
    });
  }

  static getHolds() {
    return this.request('/api/holds');
  }

  static createHold(payload: any) {
    return this.request('/api/holds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getEvidence() {
    return this.request('/api/evidence');
  }

  static reconcile() {
    return this.request('/api/reconcile', {
      method: 'POST',
    });
  }
}
