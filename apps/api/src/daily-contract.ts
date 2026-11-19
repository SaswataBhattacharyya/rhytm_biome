import { z } from 'zod';

export const date = z.iso.date();
export const timezone = z.string().min(1).max(64).refine(value => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return /^[A-Za-z][A-Za-z0-9_+/-]*$/.test(value);
  } catch {
    return false;
  }
});

export const profilePatch = z.strictObject({
  base_revision: z.number().int().min(1).max(2147483647),
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  timezone: timezone.optional(),
  locale: z.enum(['en-IN', 'en']).optional(),
}).refine(input => Object.keys(input).length > 1);

export const syntheticNotice = {
  purpose: 'synthetic_daily_logging',
  policy_version: 'demo-1',
} as const;

export const consentChange = z.strictObject({
  purpose: z.literal(syntheticNotice.purpose),
  policy_version: z.literal(syntheticNotice.policy_version),
  action: z.enum(['grant', 'revoke']),
});

export const consentQuery = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.string().regex(/^([1-9][0-9]?|100)$/).transform(Number).optional(),
});

export const logDefinitionId = '7ec13659-af4c-4ccf-b7c0-778ee655deed';

const mood = z.strictObject({
  question_key: z.literal('mood'),
  value_type: z.literal('single_select'),
  source: z.literal('manual'),
  value: z.enum(['low', 'meh', 'okay', 'good', 'great']),
});

export const dailyLogInput = z.strictObject({
  base_revision: z.number().int().min(0).max(2147483647),
  timezone,
  definition_version_id: z.literal(logDefinitionId),
  status: z.enum(['partial', 'complete']),
  answers: z.array(mood).max(1),
  dose_outcomes: z.tuple([]),
}).refine(input => input.status === 'partial' || input.answers.length === 1);

export const idempotencyKey = z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);
export const progressQuery = z.strictObject({
  from: date,
  to: date,
  domain: z.enum(['gut', 'skin', 'vaginal']).optional(),
});

export const featureConfig = {
  version: 1,
  min_build: 1,
  features: { ads: false, professionals: false, media: false },
  component_capabilities: [],
};

export function localDateAt(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
