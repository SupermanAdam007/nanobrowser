import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { SessionLog } from './types';

const MAX_SESSIONS = 50;

const indexStorage = createStorage<string[]>('session-log-index', [], {
  storageEnum: StorageEnum.Local,
  liveUpdate: false,
});

function makeSessionStorage(id: string) {
  return createStorage<SessionLog | null>(`session-log-${id}`, null, {
    storageEnum: StorageEnum.Local,
    liveUpdate: false,
  });
}

export const sessionLogStore = {
  async save(log: SessionLog): Promise<void> {
    await makeSessionStorage(log.id).set(log);
    const current = await indexStorage.get();
    const updated = [log.id, ...current.filter(id => id !== log.id)].slice(0, MAX_SESSIONS);
    await indexStorage.set(updated);
  },

  async getAll(): Promise<SessionLog[]> {
    const ids = await indexStorage.get();
    const logs = await Promise.all(ids.map(id => makeSessionStorage(id).get()));
    return logs.filter((l): l is SessionLog => l !== null);
  },

  async clear(): Promise<void> {
    const ids = await indexStorage.get();
    await Promise.all(ids.map(id => makeSessionStorage(id).set(null)));
    await indexStorage.set([]);
  },

  async count(): Promise<number> {
    const ids = await indexStorage.get();
    return ids.length;
  },
};
