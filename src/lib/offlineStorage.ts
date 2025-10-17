// Offline data storage using IndexedDB
type OfflinePayload = Record<string, unknown>;

interface OfflineData {
  id: string;
  type: 'shopping_list' | 'chore' | 'meal_plan' | 'bill' | 'recipe';
  data: OfflinePayload;
  timestamp: number;
  synced: boolean;
}

class OfflineStorageManager {
  private static instance: OfflineStorageManager;
  private db: IDBDatabase | null = null;
  private dbName = 'HomeManagementOffline';
  private version = 1;

  static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager();
    }
    return OfflineStorageManager.instance;
  }

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for offline data
        if (!db.objectStoreNames.contains('offlineData')) {
          const store = db.createObjectStore('offlineData', { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create object store for sync queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async storeData(type: OfflineData['type'], data: OfflinePayload): Promise<string> {
    if (!this.db) await this.init();

    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineData: OfflineData = {
      id,
      type,
      data,
      timestamp: Date.now(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.add(offlineData);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getData(type?: OfflineData['type']): Promise<OfflineData[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = type 
        ? store.index('type').getAll(type)
        : store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markAsSynced(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearSyncedData(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(true));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedData(): Promise<OfflineData[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const index = store.index('synced');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Background sync manager
class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  async registerSync(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (syncManager) {
      await syncManager.register('background-sync');
    }
  }

  async processSyncQueue(): Promise<void> {
    const storage = OfflineStorageManager.getInstance();
    const unsyncedData = await storage.getUnsyncedData();

    for (const item of unsyncedData) {
      try {
        await this.syncItem(item);
        await storage.markAsSynced(item.id);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
      }
    }
  }

  private async syncItem(item: OfflineData): Promise<void> {
    const { type, data } = item;
    
    switch (type) {
      case 'shopping_list':
        await fetch('/api/shopping-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
      case 'chore':
        await fetch('/api/chores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
      case 'meal_plan':
        await fetch('/api/meal-planner', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
      case 'bill':
        await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
      case 'recipe':
        await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;
    }
  }
}

// Export singleton instances
export const offlineStorage = OfflineStorageManager.getInstance();
export const backgroundSync = BackgroundSyncManager.getInstance();

// React hooks for offline functionality
export function useOfflineStorage() {
  const storeData = async (type: OfflineData['type'], data: OfflinePayload) => {
    return offlineStorage.storeData(type, data);
  };

  const getData = async (type?: OfflineData['type']) => {
    return offlineStorage.getData(type);
  };

  const syncData = async () => {
    await backgroundSync.processSyncQueue();
  };

  const clearSyncedData = async () => {
    await offlineStorage.clearSyncedData();
  };

  return {
    storeData,
    getData,
    syncData,
    clearSyncedData,
  };
}

// Initialize offline storage
if (typeof window !== 'undefined') {
  offlineStorage.init();
}
