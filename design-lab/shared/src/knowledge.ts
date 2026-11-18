/**
 * Knowledge cards — D0 client model, placeholder fixtures and a replaceable
 * async fixture transport.
 *
 * Shape follows the design-time contract
 *   Rhythm_Biome_Codex_Planning_Pack_v0.4/contracts/knowledge-cards.openapi.json
 *   (components.schemas.ContentFields, Illustration, Paragraph, BulletList, Source).
 * It is NOT a deployed API. No HTTP server, database or publish workflow here.
 *
 * Every fixture is an explicit placeholder (`is_placeholder: true`) carrying no
 * scientific or clinical claim. The contract's public reads only ever return
 * published, non-placeholder revisions, so these records are typed as
 * `DemoKnowledgeRecord` (draft-like preview) rather than `PublicCard`.
 */

export type KnowledgeKind = 'microbe_explainer' | 'knowledge_note';

/**
 * Minimal platform-neutral signal/timer types: shared compiles with lib ES2020
 * only (no DOM), and runs on web and React Native, which both provide these.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
}
declare const setTimeout: (fn: () => void, ms: number) => unknown;
declare const clearTimeout: (handle: unknown) => void;

export interface KnowledgeIllustration {
  /** Supported illustration reference, pattern ^[a-z][a-z0-9_-]{1,63}$ */
  ref: string;
  asset_id?: string;
  alt: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletListBlock {
  type: 'bullet_list';
  items: string[];
}

export type KnowledgeBlock = ParagraphBlock | BulletListBlock;

export interface KnowledgeSource {
  title: string;
  url: string;
}

/** Mirrors contract ContentFields exactly (additionalProperties: false). */
export interface ContentFields {
  key: string;
  locale: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  illustration: KnowledgeIllustration;
  blocks: KnowledgeBlock[];
  is_placeholder: boolean;
  sources: KnowledgeSource[];
}

/**
 * D0-only preview record. Real public reads return PublicCard
 * ({ id, revision, published_at, content } with is_placeholder === false).
 */
export interface DemoKnowledgeRecord {
  id: string;
  revision: number;
  status: 'demo_placeholder';
  content: ContentFields;
}

export interface KnowledgeListQuery {
  kind?: KnowledgeKind;
  key?: string;
  locale?: string;
  cursor?: string;
  limit?: number;
}

export interface KnowledgeListPage {
  items: DemoKnowledgeRecord[];
  next_cursor: string | null;
}

/** Replaceable transport. A future HTTP client implements the same interface. */
export interface KnowledgeTransport {
  list(query: KnowledgeListQuery, signal?: AbortSignalLike): Promise<KnowledgeListPage>;
  /** Resolves null when the key has no record for that locale (contract 404). */
  get(key: string, locale: string, signal?: AbortSignalLike): Promise<DemoKnowledgeRecord | null>;
}

export class KnowledgeTransportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------- scene mapping

/** Supported illustration refs in D0 (contract gap: Codex owns the real registry). */
export const ILLUSTRATION_REFS = ['hairy_sphere', 'short_rod', 'twin_strand_rod', 'cell_chain', 'note_lens', 'note_log'] as const;
export type IllustrationRef = (typeof ILLUSTRATION_REFS)[number];

/**
 * Scene morphology → stable content key. Many scene instances share one key;
 * a scene instance id is never a species or clinical identifier.
 */
export const KNOWLEDGE_KEY_BY_MORPHOLOGY = {
  hairy: 'hairy_sphere_demo',
  shortRod: 'short_rod_demo',
  flagellate: 'twin_strand_rod_demo',
  chain: 'cell_chain_demo',
} as const;

/** A key the scene may reference that has no content yet (demonstrates "coming soon"). */
export const DEMO_MISSING_KEY = 'unreviewed_microbe_demo';

export const PLACEHOLDER_NOTICE = 'Illustrative placeholder — content to be added/reviewed.';

// ---------------------------------------------------------------- fixtures

const placeholderBlocks = (what: string): KnowledgeBlock[] => [
  {
    type: 'paragraph',
    text: `Placeholder only. Approved explanations and sources will be added later. This ${what} does not identify a species.`,
  },
];

export const KNOWLEDGE_FIXTURES: DemoKnowledgeRecord[] = [
  {
    id: 'demo_kc_hairy_sphere',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'hairy_sphere_demo',
      locale: 'en',
      kind: 'microbe_explainer',
      title: 'Meet this illustrated microbe',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'hairy_sphere', alt: 'Stylized round microbe with fine surface projections' },
      blocks: placeholderBlocks('illustration'),
      is_placeholder: true,
      sources: [],
    },
  },
  {
    id: 'demo_kc_short_rod',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'short_rod_demo',
      locale: 'en',
      kind: 'microbe_explainer',
      title: 'A rod-shaped illustration',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'short_rod', alt: 'Stylized capsule-shaped microbe with short surface projections' },
      blocks: [
        ...placeholderBlocks('illustration'),
        { type: 'bullet_list', items: ['Placeholder point one.', 'Placeholder point two.'] },
      ],
      is_placeholder: true,
      sources: [],
    },
  },
  {
    id: 'demo_kc_twin_strand_rod',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'twin_strand_rod_demo',
      locale: 'en',
      kind: 'microbe_explainer',
      title: 'A rod with two long strands',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'twin_strand_rod', alt: 'Stylized capsule-shaped microbe trailing two long thin strands' },
      blocks: placeholderBlocks('illustration'),
      is_placeholder: true,
      sources: [],
    },
  },
  {
    id: 'demo_kc_cell_chain',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'cell_chain_demo',
      locale: 'en',
      kind: 'microbe_explainer',
      title: 'A curved chain of round cells',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'cell_chain', alt: 'Stylized short curved chain of round cells' },
      blocks: placeholderBlocks('illustration'),
      is_placeholder: true,
      sources: [],
    },
  },
  {
    id: 'demo_kc_note_lens',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'about_the_illustrations_demo',
      locale: 'en',
      kind: 'knowledge_note',
      title: 'About these illustrations',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'note_lens', alt: 'Simple magnifying lens outline' },
      blocks: [
        {
          type: 'paragraph',
          text: 'Placeholder only. A reviewed note about how the drawings are stylized will appear here.',
        },
      ],
      is_placeholder: true,
      sources: [],
    },
  },
  {
    id: 'demo_kc_note_log',
    revision: 1,
    status: 'demo_placeholder',
    content: {
      key: 'logs_and_lab_results_demo',
      locale: 'en',
      kind: 'knowledge_note',
      title: 'Your log and your lab report',
      summary: 'Illustrative placeholder — content to be added and reviewed.',
      illustration: { ref: 'note_log', alt: 'Calendar outline with a check mark' },
      blocks: [
        {
          type: 'paragraph',
          text: 'Placeholder only. Reviewed copy will explain how self-reported check-ins are kept separate from lab measurements.',
        },
      ],
      is_placeholder: true,
      sources: [],
    },
  },
];

// ---------------------------------------------------------------- fixture transport

export interface FixtureTransportOptions {
  records?: DemoKnowledgeRecord[];
  /** Simulated network latency (ms). */
  latencyMs?: number;
  /** 'ok' normal; 'error' every call rejects; 'errorOnce' next call rejects then recovers. */
  failMode?: 'ok' | 'error' | 'errorOnce';
}

export interface FixtureTransport extends KnowledgeTransport {
  setFailMode(mode: 'ok' | 'error' | 'errorOnce'): void;
}

function wait(ms: number, signal?: AbortSignalLike): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new KnowledgeTransportError('aborted', 'Request was cancelled.'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new KnowledgeTransportError('aborted', 'Request was cancelled.'));
      },
      { once: true },
    );
  });
}

export function createFixtureTransport(opts: FixtureTransportOptions = {}): FixtureTransport {
  const records = opts.records ?? KNOWLEDGE_FIXTURES;
  const latency = opts.latencyMs ?? 250;
  let failMode = opts.failMode ?? 'ok';

  const maybeFail = () => {
    if (failMode === 'error') throw new KnowledgeTransportError('unavailable', 'Knowledge content is unavailable (simulated).');
    if (failMode === 'errorOnce') {
      failMode = 'ok';
      throw new KnowledgeTransportError('unavailable', 'Knowledge content is unavailable (simulated).');
    }
  };

  return {
    setFailMode(mode) {
      failMode = mode;
    },
    async list(query, signal) {
      await wait(latency, signal);
      maybeFail();
      const locale = query.locale ?? 'en';
      const limit = Math.max(1, Math.min(50, query.limit ?? 20));
      const filtered = records.filter(
        (r) =>
          r.content.locale === locale &&
          (!query.kind || r.content.kind === query.kind) &&
          (!query.key || r.content.key === query.key),
      );
      const start = query.cursor ? Number(query.cursor) || 0 : 0;
      const items = filtered.slice(start, start + limit);
      const next = start + limit < filtered.length ? String(start + limit) : null;
      return { items, next_cursor: next };
    },
    async get(key, locale, signal) {
      await wait(latency, signal);
      maybeFail();
      // No locale fallback is invented: a missing locale is a missing card.
      return records.find((r) => r.content.key === key && r.content.locale === locale) ?? null;
    },
  };
}

export type KnowledgeLoadResult =
  | { status: 'ready'; record: DemoKnowledgeRecord }
  | { status: 'missing'; key: string }
  | { status: 'error'; message: string };

export async function loadKnowledgeCard(
  transport: KnowledgeTransport,
  key: string,
  locale = 'en',
  signal?: AbortSignalLike,
): Promise<KnowledgeLoadResult> {
  try {
    const record = await transport.get(key, locale, signal);
    return record ? { status: 'ready', record } : { status: 'missing', key };
  } catch (err) {
    if (err instanceof KnowledgeTransportError && err.code === 'aborted') throw err;
    return { status: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' };
  }
}

/** One shared demo transport per JS runtime (web tab / native app). */
let shared: FixtureTransport | null = null;
export function getDemoKnowledgeTransport(): FixtureTransport {
  if (!shared) shared = createFixtureTransport();
  return shared;
}

// ---------------------------------------------------------------- validation

const KEY_RE = /^[a-z][a-z0-9_-]{1,63}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * Lightweight runtime check of contract ContentFields constraints.
 * Returns a list of problems (empty = valid). Not a substitute for backend
 * publish validation (review, media approval, sources, self-approval).
 */
export function validateContentFields(c: ContentFields): string[] {
  const p: string[] = [];
  const len = (s: unknown, min: number, max: number, field: string) => {
    if (typeof s !== 'string' || s.length < min || s.length > max) p.push(`${field}: length ${min}–${max}`);
  };
  const allowed = ['key', 'locale', 'kind', 'title', 'summary', 'illustration', 'blocks', 'is_placeholder', 'sources'];
  for (const k of Object.keys(c)) if (!allowed.includes(k)) p.push(`unexpected field ${k}`);
  if (!KEY_RE.test(c.key)) p.push('key: pattern');
  if (!LOCALE_RE.test(c.locale)) p.push('locale: pattern');
  if (c.kind !== 'microbe_explainer' && c.kind !== 'knowledge_note') p.push('kind: enum');
  len(c.title, 1, 120, 'title');
  len(c.summary, 1, 280, 'summary');
  if (!c.illustration || !KEY_RE.test(c.illustration.ref)) p.push('illustration.ref: pattern');
  len(c.illustration?.alt, 1, 240, 'illustration.alt');
  if (!Array.isArray(c.blocks) || c.blocks.length < 1 || c.blocks.length > 12) p.push('blocks: 1–12');
  for (const [i, b] of (c.blocks ?? []).entries()) {
    if (b.type === 'paragraph') len(b.text, 1, 1200, `blocks[${i}].text`);
    else if (b.type === 'bullet_list') {
      if (b.items.length < 1 || b.items.length > 8) p.push(`blocks[${i}].items: 1–8`);
      b.items.forEach((it, j) => len(it, 1, 300, `blocks[${i}].items[${j}]`));
    } else p.push(`blocks[${i}]: unsupported type`);
  }
  if (typeof c.is_placeholder !== 'boolean') p.push('is_placeholder: boolean');
  if (!Array.isArray(c.sources) || c.sources.length > 12) p.push('sources: ≤12');
  for (const [i, s] of (c.sources ?? []).entries()) {
    len(s.title, 1, 240, `sources[${i}].title`);
    if (!/^https:\/\//.test(s.url)) p.push(`sources[${i}].url: https`);
  }
  return p;
}
