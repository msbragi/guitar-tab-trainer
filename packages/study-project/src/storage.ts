import type {
  PortableProjectBundle,
  StudyProject,
  StudyProjectStoragePort,
  StudyProjectSummary,
  VariantMediaPayload,
} from './models.js';

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

/**
 * Reference in-memory implementation of StudyProjectStoragePort for tests and fallback when IndexedDB is unavailable.
 */
export class InMemoryStudyProjectStore implements StudyProjectStoragePort {
  private readonly projects = new Map<string, StudyProject>();
  private readonly scores = new Map<string, Uint8Array>();
  private readonly media = new Map<string, VariantMediaPayload>();

  async listProjects(): Promise<readonly StudyProjectSummary[]> {
    return [...this.projects.values()]
      .map(toSummary)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  async loadProject(
    projectId: string,
  ): Promise<{ readonly project: StudyProject; readonly scoreBytes: Uint8Array } | null> {
    const project = this.projects.get(projectId);
    const scoreBytes = this.scores.get(projectId);
    if (!project || !scoreBytes) return null;
    return {
      project: cloneProject(project),
      scoreBytes: new Uint8Array(scoreBytes),
    };
  }

  async saveProject(project: StudyProject, scoreBytes?: Uint8Array): Promise<void> {
    const normalized: StudyProject = {
      ...cloneProject(project),
      phraseCount: project.phrases.length,
    };
    if (scoreBytes !== undefined) {
      this.scores.set(project.id, new Uint8Array(scoreBytes));
    } else if (!this.scores.has(project.id)) {
      throw new Error(`Missing Guitar Pro bytes for new project ${project.id}`);
    }
    this.projects.set(project.id, normalized);
  }

  async toggleFavorite(projectId: string, favorite?: boolean): Promise<StudyProject | null> {
    const existing = this.projects.get(projectId);
    if (!existing) return null;
    const updated: StudyProject = {
      ...existing,
      favorite: favorite ?? !existing.favorite,
    };
    this.projects.set(projectId, updated);
    return cloneProject(updated);
  }

  async deleteProject(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    this.scores.delete(projectId);
    for (const [mediaId, item] of this.media.entries()) {
      if (item.projectId === projectId) {
        this.media.delete(mediaId);
      }
    }
  }

  async loadMedia(mediaId: string): Promise<VariantMediaPayload | null> {
    const item = this.media.get(mediaId);
    return item
      ? { ...item, bytes: new Uint8Array(item.bytes) }
      : null;
  }

  async saveMedia(payload: VariantMediaPayload): Promise<void> {
    this.media.set(payload.id, {
      ...payload,
      bytes: new Uint8Array(payload.bytes),
    });
  }

  async deleteMedia(mediaId: string): Promise<void> {
    this.media.delete(mediaId);
  }
}

function cloneProject(project: StudyProject): StudyProject {
  return JSON.parse(JSON.stringify(project)) as StudyProject;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.byteLength; i += 3) {
    const triplet = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    result +=
      BASE64_CHARS[(triplet >>> 18) & 63]! +
      BASE64_CHARS[(triplet >>> 12) & 63]! +
      BASE64_CHARS[(triplet >>> 6) & 63]! +
      BASE64_CHARS[triplet & 63]!;
  }
  const remaining = bytes.byteLength - i;
  if (remaining === 1) {
    const n = bytes[i]! << 16;
    result += BASE64_CHARS[(n >>> 18) & 63]! + BASE64_CHARS[(n >>> 12) & 63]! + '==';
  } else if (remaining === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    result +=
      BASE64_CHARS[(n >>> 18) & 63]! +
      BASE64_CHARS[(n >>> 12) & 63]! +
      BASE64_CHARS[(n >>> 6) & 63]! +
      '=';
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((clean.length * 3) / 4) - pad;
  const out = new Uint8Array(Math.max(0, byteLength));
  let outIdx = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]!);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]!);
    const c2 = clean[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 2]!);
    const c3 = clean[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 3]!);
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIdx < out.byteLength) out[outIdx++] = (triplet >>> 16) & 0xff;
    if (outIdx < out.byteLength) out[outIdx++] = (triplet >>> 8) & 0xff;
    if (outIdx < out.byteLength) out[outIdx++] = triplet & 0xff;
  }
  return out;
}

/**
 * Serializes a StudyProject and its original GP bytes into a portable JSON bundle (.gtt.json).
 */
export function exportPortableProjectBundle(
  project: StudyProject,
  scoreBytes: Uint8Array,
  mediaPayloads: readonly VariantMediaPayload[] = [],
  exportedAt = new Date().toISOString(),
): PortableProjectBundle {
  const mediaBase64: Record<string, { mimeType: VariantMediaPayload['mimeType']; data: string }> = {};
  for (const item of mediaPayloads) {
    mediaBase64[item.id] = {
      mimeType: item.mimeType,
      data: bytesToBase64(item.bytes),
    };
  }
  return {
    format: 'gtt-project-v1',
    exportedAt,
    project: {
      ...cloneProject(project),
      phraseCount: project.phrases.length,
    },
    scoreBase64: bytesToBase64(scoreBytes),
    ...(Object.keys(mediaBase64).length > 0 ? { mediaBase64 } : {}),
  };
}

/**
 * Validates and unpacks a PortableProjectBundle back into domain objects.
 */
export function importPortableProjectBundle(bundle: unknown): {
  readonly project: StudyProject;
  readonly scoreBytes: Uint8Array;
  readonly mediaPayloads: readonly VariantMediaPayload[];
} {
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Invalid project bundle');
  }
  const candidate = bundle as Partial<PortableProjectBundle>;
  if (
    candidate.format !== 'gtt-project-v1' ||
    !candidate.project ||
    typeof candidate.project.id !== 'string' ||
    typeof candidate.scoreBase64 !== 'string'
  ) {
    throw new Error('Unsupported or malformed GTT project bundle');
  }

  const scoreBytes = base64ToBytes(candidate.scoreBase64);
  if (scoreBytes.byteLength === 0) {
    throw new Error('Project bundle contains empty Guitar Pro bytes');
  }

  const project: StudyProject = {
    ...cloneProject(candidate.project),
    phraseCount: Array.isArray(candidate.project.phrases)
      ? candidate.project.phrases.length
      : 0,
  };

  const mediaPayloads: VariantMediaPayload[] = [];
  if (candidate.mediaBase64 && typeof candidate.mediaBase64 === 'object') {
    for (const phrase of project.phrases) {
      for (const variant of phrase.variants) {
        if (!variant.mediaId) continue;
        const entry = candidate.mediaBase64[variant.mediaId];
        if (entry && typeof entry.data === 'string') {
          mediaPayloads.push({
            id: variant.mediaId,
            projectId: project.id,
            phraseId: phrase.id,
            variantId: variant.id,
            mimeType: entry.mimeType,
            bytes: base64ToBytes(entry.data),
          });
        }
      }
    }
  }

  return { project, scoreBytes, mediaPayloads };
}
