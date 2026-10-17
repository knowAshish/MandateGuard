import { randomUUID } from 'node:crypto';

export interface LedgerConfig {
  baseUrl: string; // e.g. "http://localhost:7575" or DevNet participant endpoint
  token?: string; // Optional JWT token for authentication
  ledgerId?: string;
  timeoutMs?: number;
}

export interface LedgerCommand {
  commandType: 'create' | 'exercise';
  templateId: string;
  contractId?: string;
  choice?: string;
  argument?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface SubmissionRequest {
  commandId?: string;
  actAs: string[];
  readAs?: string[];
  commands: LedgerCommand[];
  deduplicationPeriodSeconds?: number;
}

export interface SubmissionResponse {
  updateId: string;
  completionOffset: string;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  contractId?: string;
  events?: Array<{
    eventType: string;
    contractId: string;
    templateId: string;
    payload?: unknown;
  }>;
}

export interface ActiveContract<T = unknown> {
  contractId: string;
  templateId: string;
  signatories: string[];
  observers: string[];
  payload: T;
  createdAt?: string;
}

export interface HealthCheckResult {
  connected: boolean;
  participantUrl: string;
  ledgerId?: string;
  statusCode?: number;
  error?: string;
  latencyMs: number;
}

/**
 * Robust Canton Ledger API client.
 * Connects to the Canton JSON Ledger API v2 exposed by participant nodes.
 */
export class CantonLedgerClient {
  private config: LedgerConfig;

  constructor(config: LedgerConfig) {
    this.config = {
      timeoutMs: 30000,
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  /**
   * Ping participant node and verify Ledger API connectivity.
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Test basic connectivity endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.config.baseUrl}/livez`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to active contracts check
        return await fetch(`${this.config.baseUrl}/v2/state/active-contracts`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ verbose: false, filter: { filtersByParty: {} } }),
          signal: controller.signal,
        });
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      return {
        connected: res.status >= 200 && res.status < 500,
        participantUrl: this.config.baseUrl,
        statusCode: res.status,
        latencyMs,
      };
    } catch (err) {
      return {
        connected: false,
        participantUrl: this.config.baseUrl,
        error: (err as Error).message,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Submit commands to the Canton ledger and wait for authoritative commit.
   * Uses JSON Ledger API v2 POST /v2/commands/submit-and-wait
   */
  async submitAndWait(req: SubmissionRequest): Promise<SubmissionResponse> {
    const commandId = req.commandId || `CMD-${randomUUID()}`;
    const url = `${this.config.baseUrl}/v2/commands/submit-and-wait`;

    const body = {
      commands: {
        commandId,
        actAs: req.actAs,
        readAs: req.readAs || [],
        commands: req.commands.map((cmd) => {
          if (cmd.commandType === 'create') {
            return {
              createCommand: {
                templateId: cmd.templateId,
                createArguments: cmd.payload,
              },
            };
          } else {
            return {
              exerciseCommand: {
                templateId: cmd.templateId,
                contractId: cmd.contractId,
                choice: cmd.choice,
                choiceArgument: cmd.argument,
              },
            };
          }
        }),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text();
        return {
          updateId: '',
          completionOffset: '',
          status: 'ERROR',
          errorMessage: `Ledger rejected command (${res.status}): ${errorText}`,
        };
      }

      const json = await res.json() as any;
      const updateId = json.updateId || json.transaction?.updateId || json.transactionId || `TX-${randomUUID().slice(0, 8)}`;
      const completionOffset = json.completionOffset || json.offset || '0';

      return {
        updateId,
        completionOffset,
        status: 'SUCCESS',
        contractId: json.transaction?.events?.[0]?.createdEvent?.contractId,
        events: json.transaction?.events,
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        updateId: '',
        completionOffset: '',
        status: 'ERROR',
        errorMessage: (err as Error).message,
      };
    }
  }

  /**
   * Query the Active Contract Set (ACS) filtered by template and parties.
   */
  async queryActiveContracts<T = unknown>(
    templateId: string,
    party: string
  ): Promise<ActiveContract<T>[]> {
    const url = `${this.config.baseUrl}/v2/state/active-contracts`;

    const body = {
      verbose: true,
      filter: {
        filtersByParty: {
          [party]: {
            cumulative: [
              {
                templateFilter: {
                  templateId,
                },
              },
            ],
          },
        },
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return [];
      }

      const json = await res.json() as any;
      const contracts: ActiveContract<T>[] = [];

      const contractEntries = json.contractEntries || json.activeContracts || [];
      for (const entry of contractEntries) {
        const created = entry.createdEvent || entry;
        if (created.contractId) {
          contracts.push({
            contractId: created.contractId,
            templateId: created.templateId,
            signatories: created.signatories || [],
            observers: created.observers || [],
            payload: created.createArguments || created.payload,
            createdAt: created.createdAt,
          });
        }
      }

      return contracts;
    } catch {
      return [];
    }
  }
}
