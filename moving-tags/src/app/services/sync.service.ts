import { Injectable } from '@angular/core';

export type SyncClientId = string;

@Injectable({ providedIn: 'root' })
export class SyncService {
  static readonly CLIENT_ID_KEY = 'clientId';
  static readonly LAST_SYNC_KEY = 'lastSync';
  static readonly FAKE_CLIENT_ID = 'FAKE_CLIENT_FOR_DISPLAY';

  public clientId: SyncClientId;
  public lastSync: Record<SyncClientId, Date> = {};

  constructor() {
    const storedClientId = localStorage.getItem(SyncService.CLIENT_ID_KEY);
    if (storedClientId) {
      this.clientId = storedClientId;
    } else {
      this.clientId = this.generateClientId();
      localStorage.setItem(SyncService.CLIENT_ID_KEY, this.clientId);
    }
    const storedLastSync = localStorage.getItem(SyncService.LAST_SYNC_KEY);
    if (storedLastSync) {
      try {
        const parsed = JSON.parse(storedLastSync);
        for (const k in parsed) {
          this.lastSync[k] = new Date(parsed[k]);
        }
      } catch {}
    }
  }

  private generateClientId(): SyncClientId {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  setLastSync(clientId: SyncClientId, date: Date) {
    this.lastSync[clientId] = date;
    localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }
}
