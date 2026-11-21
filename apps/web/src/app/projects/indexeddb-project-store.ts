import {
  InMemoryStudyProjectStore,
  type StudyProject,
  type StudyProjectStoragePort,
  type StudyProjectSummary,
  type VariantMediaPayload,
} from '@guitar-practice/study-project';

const DATABASE_NAME = 'guitar-practice-projects-v1';
const DATABASE_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SCORES = 'scores';
const STORE_MEDIA = 'media';
const INDEX_MEDIA_BY_PROJECT = 'byProjectId';

interface StoredScoreRecord {
  readonly id: string;
  readonly bytes: Uint8Array;
}

function toSummary(project: StudyProject): StudyProjectSummary {
  return {
    id: project.id,
    fileName: project.fileName,
    title: project.title,
    artist: project.artist,
    trackCount: project.trackCount,
    barCount: project.barCount,
    favorite: project.favorite,
    phraseCount: project.phrases.length,
    lastOpenedAt: project.lastOpenedAt,
    createdAt: project.createdAt,
  };
}

function cloneProject(project: StudyProject): StudyProject {
  return JSON.parse(JSON.stringify(project)) as StudyProject;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

/**
 * Browser IndexedDB implementation of StudyProjectStoragePort with transparent
 * fallback to InMemoryStudyProjectStore when IndexedDB is unavailable or blocked.
 */
export class IndexedDbStudyProjectStore implements StudyProjectStoragePort {
  private databasePromise: Promise<IDBDatabase | null> | undefined;
  private closed = false;
  private readonly fallback = new InMemoryStudyProjectStore();

  constructor(private readonly factory: IDBFactory | undefined) {}

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.closed || !this.factory) return Promise.resolve(null);
    return (this.databasePromise ??= new Promise((resolve) => {
      let finished = false;
      const finish = (database: IDBDatabase | null) => {
        if (finished) {
          database?.close();
          return;
        }
        finished = true;
        clearTimeout(timeout);
        resolve(database);
      };

      const timeout = setTimeout(() => finish(null), 1500);
      try {
        const request = this.factory!.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
            db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_SCORES)) {
            db.createObjectStore(STORE_SCORES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_MEDIA)) {
            const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
            mediaStore.createIndex(INDEX_MEDIA_BY_PROJECT, 'projectId', { unique: false });
          }
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.closed = true;
          };
          if (this.closed) {
            db.close();
            finish(null);
          } else {
            finish(db);
          }
        };
      } catch {
        finish(null);
      }
    }));
  }

  async listProjects(): Promise<readonly StudyProjectSummary[]> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.listProjects();

    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const items = (await requestToPromise(store.getAll())) as StudyProject[];
    await transactionDone(tx);
    return items
      .map(toSummary)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  async loadProject(
    projectId: string,
  ): Promise<{ readonly project: StudyProject; readonly scoreBytes: Uint8Array } | null> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.loadProject(projectId);

    const tx = db.transaction([STORE_PROJECTS, STORE_SCORES], 'readonly');
    const projectReq = tx.objectStore(STORE_PROJECTS).get(projectId);
    const scoreReq = tx.objectStore(STORE_SCORES).get(projectId);
    const [project, scoreRecord] = await Promise.all([
      requestToPromise(projectReq) as Promise<StudyProject | undefined>,
      requestToPromise(scoreReq) as Promise<StoredScoreRecord | Uint8Array | undefined>,
    ]);
    await transactionDone(tx);

    if (!project || !scoreRecord) return null;
    const rawBytes = scoreRecord instanceof Uint8Array ? scoreRecord : scoreRecord.bytes;
    if (!(rawBytes instanceof Uint8Array)) return null;

    return {
      project: cloneProject(project),
      scoreBytes: new Uint8Array(rawBytes),
    };
  }

  async saveProject(project: StudyProject, scoreBytes?: Uint8Array): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.saveProject(project, scoreBytes);

    const normalized: StudyProject = {
      ...cloneProject(project),
      phraseCount: project.phrases.length,
    };

    const tx = db.transaction([STORE_PROJECTS, STORE_SCORES], 'readwrite');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const scoreStore = tx.objectStore(STORE_SCORES);

    if (scoreBytes !== undefined) {
      const record: StoredScoreRecord = {
        id: project.id,
        bytes: new Uint8Array(scoreBytes),
      };
      scoreStore.put(record);
    } else {
      const existingScore = await requestToPromise(scoreStore.getKey(project.id));
      if (existingScore === undefined) {
        tx.abort();
        throw new Error(`Missing Guitar Pro bytes for new project ${project.id}`);
      }
    }

    projectStore.put(normalized);
    await transactionDone(tx);
  }

  async toggleFavorite(projectId: string, favorite?: boolean): Promise<StudyProject | null> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.toggleFavorite(projectId, favorite);

    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const existing = (await requestToPromise(store.get(projectId))) as StudyProject | undefined;
    if (!existing) {
      await transactionDone(tx);
      return null;
    }

    const updated: StudyProject = {
      ...cloneProject(existing),
      favorite: favorite ?? !existing.favorite,
      phraseCount: existing.phrases.length,
    };
    store.put(updated);
    await transactionDone(tx);
    return cloneProject(updated);
  }

  async deleteProject(projectId: string): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.deleteProject(projectId);

    const tx = db.transaction([STORE_PROJECTS, STORE_SCORES, STORE_MEDIA], 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    tx.objectStore(STORE_SCORES).delete(projectId);

    const mediaStore = tx.objectStore(STORE_MEDIA);
    const byProject = mediaStore.index(INDEX_MEDIA_BY_PROJECT);
    const keys = await requestToPromise(byProject.getAllKeys(projectId));
    for (const key of keys) {
      mediaStore.delete(key);
    }

    await transactionDone(tx);
  }

  async loadMedia(mediaId: string): Promise<VariantMediaPayload | null> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.loadMedia(mediaId);

    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const item = (await requestToPromise(tx.objectStore(STORE_MEDIA).get(mediaId))) as
      | VariantMediaPayload
      | undefined;
    await transactionDone(tx);

    return item ? { ...item, bytes: new Uint8Array(item.bytes) } : null;
  }

  async saveMedia(payload: VariantMediaPayload): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.saveMedia(payload);

    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).put({
      ...payload,
      bytes: new Uint8Array(payload.bytes),
    });
    await transactionDone(tx);
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return this.fallback.deleteMedia(mediaId);

    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).delete(mediaId);
    await transactionDone(tx);
  }

  close(): void {
    this.closed = true;
    void this.databasePromise?.then((db) => db?.close());
  }
}
