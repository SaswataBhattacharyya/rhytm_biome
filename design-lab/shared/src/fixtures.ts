/**
 * D0 synthetic design fixtures — interface semantics only.
 *
 * Follows relay/D0_FIXTURE_EXPECTATIONS.md. NOT a finalized API, not generated
 * from OpenAPI, and not to be used as production types. No real identities,
 * prices, clinical scores, thresholds, results or endpoints.
 */

export const DEMO_USER = {
  id: 'demo_user_01',
  displayName: 'Demo account',
} as const;

/** Static, disclosed example dates. */
export const EXAMPLE_DATES = {
  today: '2026-01-15',
  todayLabel: 'Thu 15 Jan (example date)',
} as const;

// ---------------------------------------------------------------- Home

export type HomeState = 'firstVisit' | 'pendingAction' | 'loading' | 'partialFailure';

export const HOME_STATES: Array<{ id: HomeState; label: string }> = [
  { id: 'firstVisit', label: 'First visit' },
  { id: 'pendingAction', label: 'Pending test action' },
  { id: 'loading', label: 'Loading' },
  { id: 'partialFailure', label: 'Partial failure' },
];

export type DayCoverage = 'recorded' | 'partial' | 'missing';

export interface HomeFixture {
  greetingName: string;
  /** One primary next action. */
  nextAction: { title: string; body: string; cta: string; demoNote: string } | null;
  routineChips: Array<{ id: string; label: string }>;
  /** Last 7 days coverage — self-reported logging only, never a health score. */
  week: Array<{ day: string; coverage: DayCoverage }> | null;
  activeTest: { title: string; status: string; updatedLabel: string } | 'error' | null;
}

export const HOME_FIXTURES: Record<Exclude<HomeState, 'loading'>, HomeFixture> = {
  firstVisit: {
    greetingName: DEMO_USER.displayName,
    nextAction: {
      title: 'Choose your first test',
      body: 'Compare gut, skin and vaginal kits before booking.',
      cta: 'Explore tests',
      demoNote: 'Catalogue content is not part of this design specimen.',
    },
    routineChips: [],
    week: null,
    activeTest: null,
  },
  pendingAction: {
    greetingName: DEMO_USER.displayName,
    nextAction: {
      title: 'Finish your test questionnaire',
      body: 'Your kit needs a few answers before collection. About 5 minutes.',
      cta: 'Resume questionnaire',
      demoNote: 'The questionnaire is a later slice; this action explains that limitation.',
    },
    routineChips: [
      { id: 'routine_a', label: 'Morning routine item' },
      { id: 'routine_b', label: 'Evening routine item' },
    ],
    week: [
      { day: 'Fri', coverage: 'recorded' },
      { day: 'Sat', coverage: 'missing' },
      { day: 'Sun', coverage: 'partial' },
      { day: 'Mon', coverage: 'recorded' },
      { day: 'Tue', coverage: 'recorded' },
      { day: 'Wed', coverage: 'missing' },
      { day: 'Thu', coverage: 'partial' },
    ],
    activeTest: { title: 'Gut test kit (synthetic)', status: 'Kit delivered · questionnaire due', updatedLabel: 'Updated 14 Jan (example date)' },
  },
  partialFailure: {
    greetingName: DEMO_USER.displayName,
    nextAction: {
      title: 'Log today',
      body: 'A quick check-in takes under a minute.',
      cta: 'Start check-in',
      demoNote: '',
    },
    routineChips: [
      { id: 'routine_a', label: 'Morning routine item' },
      { id: 'routine_b', label: 'Evening routine item' },
    ],
    week: [
      { day: 'Fri', coverage: 'recorded' },
      { day: 'Sat', coverage: 'recorded' },
      { day: 'Sun', coverage: 'missing' },
      { day: 'Mon', coverage: 'partial' },
      { day: 'Tue', coverage: 'recorded' },
      { day: 'Wed', coverage: 'recorded' },
      { day: 'Thu', coverage: 'missing' },
    ],
    activeTest: 'error',
  },
};

// ---------------------------------------------------------------- Log

export type LogState = 'empty' | 'partial' | 'entered' | 'acknowledged' | 'offlinePending' | 'conflict';

export const LOG_STATES: Array<{ id: LogState; label: string }> = [
  { id: 'empty', label: 'Empty' },
  { id: 'partial', label: 'Partial' },
  { id: 'entered', label: 'Entered' },
  { id: 'acknowledged', label: 'Demo acknowledgement' },
  { id: 'offlinePending', label: 'Offline / pending' },
  { id: 'conflict', label: 'Conflict' },
];

export type Mood = 'low' | 'meh' | 'okay' | 'good' | 'great';
export const MOODS: Array<{ id: Mood; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'meh', label: 'Meh' },
  { id: 'okay', label: 'Okay' },
  { id: 'good', label: 'Good' },
  { id: 'great', label: 'Great' },
];

export type DoseAnswer = 'taken' | 'notTaken' | 'skipped';
export const DOSE_ANSWERS: Array<{ id: DoseAnswer; label: string }> = [
  { id: 'taken', label: 'Taken' },
  { id: 'notTaken', label: 'Not taken' },
  { id: 'skipped', label: 'Skipped on purpose' },
];

/** `none` = user reports the symptom is absent. `undefined` = not recorded. */
export type Severity = 'none' | 'mild' | 'moderate' | 'strong';
export const SEVERITIES: Array<{ id: Severity; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'strong', label: 'Strong' },
];

/** Synthetic demo symptom labels; real prompts come from an approved template. */
export const DEMO_SYMPTOMS = [
  { id: 'symptom_a', label: 'Bloating (demo label)' },
  { id: 'symptom_b', label: 'Low energy (demo label)' },
] as const;

export const DEMO_ROUTINE = [
  { id: 'routine_a', label: 'Morning routine item' },
  { id: 'routine_b', label: 'Evening routine item' },
] as const;

export interface LogDraft {
  mood?: Mood;
  doses: Partial<Record<string, DoseAnswer>>;
  symptoms: Partial<Record<string, Severity>>;
}

export const EMPTY_DRAFT: LogDraft = { doses: {}, symptoms: {} };

export const LOG_FIXTURES: Record<LogState, LogDraft> = {
  empty: EMPTY_DRAFT,
  partial: { mood: 'okay', doses: { routine_a: 'taken' }, symptoms: {} },
  entered: {
    mood: 'good',
    doses: { routine_a: 'taken', routine_b: 'skipped' },
    symptoms: { symptom_a: 'none', symptom_b: 'mild' },
  },
  acknowledged: {
    mood: 'good',
    doses: { routine_a: 'taken', routine_b: 'skipped' },
    symptoms: { symptom_a: 'none', symptom_b: 'mild' },
  },
  offlinePending: {
    mood: 'okay',
    doses: { routine_a: 'taken' },
    symptoms: { symptom_a: 'mild' },
  },
  conflict: {
    mood: 'good',
    doses: { routine_a: 'taken' },
    symptoms: { symptom_b: 'mild' },
  },
};

/** The "other device" version for the conflict fixture. Synthetic. */
export const LOG_CONFLICT_OTHER: LogDraft & { sourceLabel: string } = {
  sourceLabel: 'Version from another device (synthetic, 14:05 example time)',
  mood: 'okay',
  doses: { routine_a: 'notTaken' },
  symptoms: { symptom_b: 'moderate' },
};

export function draftCompleteness(d: LogDraft): { recorded: number; total: number } {
  const total = 1 + DEMO_ROUTINE.length + DEMO_SYMPTOMS.length;
  const recorded =
    (d.mood ? 1 : 0) +
    DEMO_ROUTINE.filter((r) => d.doses[r.id] !== undefined).length +
    DEMO_SYMPTOMS.filter((s) => d.symptoms[s.id] !== undefined).length;
  return { recorded, total };
}

// ---------------------------------------------------------------- Reports

export type ReportsState = 'none' | 'processing' | 'unavailable' | 'syntheticLayout';

export const REPORTS_STATES: Array<{ id: ReportsState; label: string }> = [
  { id: 'none', label: 'No reports' },
  { id: 'processing', label: 'Processing / review' },
  { id: 'unavailable', label: 'Unavailable / error' },
  { id: 'syntheticLayout', label: 'Synthetic layout' },
];

export interface ReportCard {
  id: string;
  category: 'gut' | 'skin' | 'vaginal';
  title: string;
  statusLabel: string;
  /** Drafts / in-review never expose a result link. */
  released: boolean;
  dateLabel: string;
}

export const REPORT_PROCESSING: ReportCard = {
  id: 'demo_report_processing',
  category: 'gut',
  title: 'Gut test (synthetic)',
  statusLabel: 'In lab review — no result yet',
  released: false,
  dateLabel: 'Sample received 10 Jan (example date)',
};

export const REPORT_LAYOUT: ReportCard = {
  id: 'demo_report_layout',
  category: 'gut',
  title: 'Report layout example',
  statusLabel: 'Synthetic placeholder layout — no real data',
  released: true,
  dateLabel: 'Example date 15 Jan',
};

/** Section skeleton for the synthetic layout. No values, no interpretation. */
export const REPORT_LAYOUT_SECTIONS: Array<{
  id: string;
  title: string;
  source: 'measured' | 'selfReported' | 'method';
  note: string;
}> = [
  { id: 'summary', title: 'Summary', source: 'measured', note: 'Reviewed summary text appears here after clinical release.' },
  { id: 'diversity', title: 'Diversity', source: 'measured', note: 'Chart placeholder. Requires approved template, units and reference version.' },
  { id: 'composition', title: 'Composition', source: 'measured', note: 'Chart and accessible table placeholder.' },
  { id: 'selfReported', title: 'What you logged', source: 'selfReported', note: 'Your own check-ins, shown separately from lab measurements.' },
  { id: 'limitations', title: 'Limitations', source: 'method', note: 'Always shown. Approved limitation text required.' },
  { id: 'method', title: 'Method, specimen and reference version', source: 'method', note: 'Populated from the released report record.' },
];

// ---------------------------------------------------------------- Preferences

export type MotionPreference = 'auto' | 'paused';
export const PREF_KEYS = {
  theme: 'rb-d0-theme',
  motion: 'rb-d0-motion',
} as const;
