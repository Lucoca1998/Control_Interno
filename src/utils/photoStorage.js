/**
 * Photo Storage with IndexedDB & Canvas Compression
 * Ensures uploaded photos never exceed localStorage limits and persist across page refreshes.
 */

import { openAppDb } from './db';

const PHOTO_STORE = 'photos';
const FALLBACK_KEY_PREFIX = 'coca_photo_';

/**
 * Compresses an image file via HTML Canvas
 */
export function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('El archivo no es una imagen válida'));
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with controlled quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Loads all stored photos from IndexedDB with localStorage fallback
 */
export async function loadAllStoredPhotos() {
  const photos = {};

  try {
    const db = await openAppDb();
    if (db && db.objectStoreNames.contains(PHOTO_STORE)) {
      await new Promise((resolve) => {
        const tx = db.transaction(PHOTO_STORE, 'readonly');
        const store = tx.objectStore(PHOTO_STORE);
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            photos[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });
    }
  } catch (err) {
    console.warn('Error reading photos from IndexedDB:', err);
  }

  // Fallback / merge with localStorage
  try {
    const legacyKey = 'coca_quality_error_photos_v1';
    const legacy = JSON.parse(window.localStorage.getItem(legacyKey) || '{}');
    for (const k of Object.keys(legacy)) {
      if (!photos[k] && legacy[k]) {
        photos[k] = legacy[k];
      }
    }
    ['faltante', 'sobrante', 'cruce', 'otro'].forEach(k => {
      const item = window.localStorage.getItem(FALLBACK_KEY_PREFIX + k);
      if (item && !photos[k]) {
        try { photos[k] = JSON.parse(item); } catch {}
      }
    });
  } catch {}

  return photos;
}

/**
 * Saves a single photo to IndexedDB and localStorage
 */
export async function saveStoredPhoto(slotId, photoData) {
  try {
    const db = await openAppDb();
    if (db && db.objectStoreNames.contains(PHOTO_STORE)) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE, 'readwrite');
        const store = tx.objectStore(PHOTO_STORE);
        const req = store.put(photoData, slotId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('Could not save photo to IndexedDB:', err);
  }

  // LocalStorage backup
  try {
    window.localStorage.setItem(FALLBACK_KEY_PREFIX + slotId, JSON.stringify(photoData));
  } catch (e) {
    // LocalStorage quota might be hit, but IndexedDB already saved it
  }
}

/**
 * Deletes a photo from IndexedDB and localStorage
 */
export async function deleteStoredPhoto(slotId) {
  try {
    const db = await openAppDb();
    if (db && db.objectStoreNames.contains(PHOTO_STORE)) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_STORE, 'readwrite');
        const store = tx.objectStore(PHOTO_STORE);
        const req = store.delete(slotId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('Could not delete photo from IndexedDB:', err);
  }

  try {
    window.localStorage.removeItem(FALLBACK_KEY_PREFIX + slotId);
    const legacyKey = 'coca_quality_error_photos_v1';
    const legacy = JSON.parse(window.localStorage.getItem(legacyKey) || '{}');
    if (legacy[slotId]) {
      delete legacy[slotId];
      window.localStorage.setItem(legacyKey, JSON.stringify(legacy));
    }
  } catch {}
}
