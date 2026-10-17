// Same schema as features/offline/store.ts; cleanup only, never serves bytes or authenticates.
export async function sweepOffline() {
  const databases = await indexedDB.databases();
  if (!databases.some((d) => d.name === 'tankyu-offline-v1')) return;
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('tankyu-offline-v1', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('control')) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(['control', 'entries', 'files'], 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
      const owner = tx.objectStore('control').get('owner');
      owner.onsuccess = () => {
        const c = owner.result;
        if (!c) return;
        const wall = Date.now();
        if (wall < c.lastWall - 60000 || wall < c.wall - 60000) c.blocked = true;
        const now = Math.max(c.lastServer, c.server ? c.server + Math.max(0, wall - c.wall) : wall);
        c.lastWall = Math.max(c.lastWall, wall);
        c.lastServer = now;
        if (c.blocked) c.grant = null;
        tx.objectStore('control').put(c, 'owner');
        const rows = tx.objectStore('entries').openCursor();
        rows.onsuccess = () => {
          const cursor = rows.result;
          if (!cursor) return;
          const row = cursor.value;
          if (c.blocked || row.expiresAt <= now) {
            tx.objectStore('files').delete(row.key);
            cursor.delete();
          }
          cursor.continue();
        };
      };
    };
  });
}
