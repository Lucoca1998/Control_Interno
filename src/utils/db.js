/**
 * Central IndexedDB Manager for Dashboard Dataset and Photos
 * Ensures persistent storage across page refreshes and browser restarts.
 */

const DB_NAME = 'coca_control_interno_v5';
const DB_VERSION = 1;
const STORE_DATASET = 'dataset';
const STORE_PHOTOS = 'photos';

export function openAppDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DATASET)) {
        db.createObjectStore(STORE_DATASET);
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

async function tryReadLegacyDataset() {
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open('coca-quality-dashboard');
      req.onsuccess = () => {
        const legacyDb = req.result;
        if (legacyDb.objectStoreNames.contains('dataset')) {
          const tx = legacyDb.transaction('dataset', 'readonly');
          const getReq = tx.objectStore('dataset').get('current');
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getStoredDataset() {
  try {
    const db = await openAppDb();
    if (!db) return null;

    const currentData = await new Promise((resolve) => {
      const tx = db.transaction(STORE_DATASET, 'readonly');
      const store = tx.objectStore(STORE_DATASET);
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (currentData) {
      return currentData;
    }

    // Try legacy database migration
    const legacyData = await tryReadLegacyDataset();
    if (legacyData && (
      (legacyData.mercado && legacyData.mercado.length > 0) ||
      (legacyData.bodega_camiones && legacyData.bodega_camiones.length > 0) ||
      (legacyData.loaded_files && legacyData.loaded_files.length > 0)
    )) {
      console.log('Migrando dataset previo a la nueva base de datos persistente...');
      await saveStoredDataset(legacyData);
      return legacyData;
    }

    return null;
  } catch (err) {
    console.error('getStoredDataset error:', err);
    return null;
  }
}

export async function saveStoredDataset(dataset) {
  try {
    const db = await openAppDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DATASET, 'readwrite');
      const store = tx.objectStore(STORE_DATASET);
      const req = store.put(dataset, 'current');
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.error('saveStoredDataset error:', req.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.error('saveStoredDataset exception:', err);
    return false;
  }
}

export async function clearStoredDataset() {
  try {
    const db = await openAppDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DATASET, 'readwrite');
      const store = tx.objectStore(STORE_DATASET);
      const req = store.delete('current');
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
