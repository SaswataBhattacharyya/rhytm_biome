/**
 * Relay 08 trust-section fixtures — local, typed and VISIBLY SYNTHETIC.
 *
 * Every person, quote, rating and review below is invented for layout review
 * and is labelled as a sample wherever it renders. None are real people,
 * customers or credentials; nothing here is approved for publication. Copy
 * avoids outcome, diagnostic and treatment claims (plan 36: keep expert
 * commentary, customer testimony and clinical claims distinct).
 *
 * Shapes are preview-local, not a contract. Publication needs approved
 * expert data and quotes, moderated reviews and counts computed by the
 * server from eligible published reviews (contract gaps, relay 08 result).
 */
import type { MicrobeKind } from '@rb-lab/shared';

export const SYNTHETIC_LABEL = 'Synthetic sample';

/** Original organism portrait placeholder (no photography in the preview). */
export interface PortraitPlaceholder {
  kind: MicrobeKind;
  seed: number;
  /** CSS colour token or value for the organism. */
  color: string;
}

export interface Expert {
  slug: string;
  name: string;
  role: string;
  /** Short bio for the card; clamped with an ellipsis if it overflows. */
  bio: string;
  /** Additional copy for the full view. Absent → no Read more unless the card clamps. */
  fullBio?: string[];
  /** Optional educational perspective, labelled as such in the full view. */
  perspective?: string;
  focus: string[];
  portrait: PortraitPlaceholder;
}

export interface Testimonial {
  id: string;
  /** Card excerpt; clamped with an ellipsis if it overflows. */
  excerpt: string;
  /** Full testimony for the reading view. */
  full?: string[];
  attribution: string;
  context: string;
}

export interface Review {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  author: string;
  /** ISO date. */
  date: string;
}

export interface ReviewSet {
  productSlug: string;
  reviews: Review[];
}

const C = { gut: '#E8B93A', skin: '#8FA77F', vaginal: '#A68BC2', blue: '#8FA7C9', clay: '#C98B6B' };

export const EXPERTS: Expert[] = [
  {
    slug: 'asha-varma',
    name: 'Dr Asha Varma',
    role: 'Microbiologist · sample profile',
    bio: 'Explains what a stool sample can and cannot tell you, in plain language.',
    fullBio: [
      'Asha is a synthetic profile used to review how the Experts directory handles a short biography with additional detail.',
      'In a published version this space would hold approved credentials, affiliations and the areas the expert reviews. None are shown here because none have been approved.',
    ],
    perspective: 'A single sample is a snapshot. Comparing samples over time, with the same method, usually says more than any one result.',
    focus: ['Gut', 'Method'],
    portrait: { kind: 'shortRod', seed: 11, color: C.gut },
  },
  {
    slug: 'rohan-iyer-mukherjee',
    name: 'Rohan Iyer-Mukherjee',
    role: 'Bioinformatics lead · sample profile',
    bio: 'Works on how sequencing reads become the charts in a report, and on keeping each processing step traceable from the lab bench to the page you finally read.',
    fullBio: [
      'Rohan is a synthetic profile with a deliberately long card biography, used to check clamping, the visible ellipsis and Read more alignment.',
      'A published profile would describe the analysis pipeline the expert oversees and link to the method notes included in every report.',
    ],
    focus: ['Reports', 'Data'],
    portrait: { kind: 'chain', seed: 12, color: C.blue },
  },
  {
    slug: 'meera-k',
    name: 'Meera K.',
    role: 'Dermatology educator · sample profile',
    bio: 'Writes the skin-microbiome learning notes.',
    focus: ['Skin'],
    portrait: { kind: 'hairy', seed: 13, color: C.skin },
  },
  {
    slug: 'priyanka-raghunathan-dsouza',
    name: 'Dr Priyanka Raghunathan-D’Souza',
    role: 'Women’s health clinician · sample profile',
    bio: 'Reviews how vaginal-microbiome information is worded so that it stays clear, private and free of alarm.',
    fullBio: [
      'Priyanka is a synthetic profile with a long name, used to check that names wrap without changing card height across the row.',
      'Clinical reviewers in a published version would be listed only with approved credentials and a clear description of what they review.',
    ],
    perspective: 'Information about the vaginal microbiome should be specific about what was measured and calm about what it means.',
    focus: ['Vaginal', 'Wording'],
    portrait: { kind: 'flagellate', seed: 14, color: C.vaginal },
  },
  {
    slug: 'sam-ortega',
    name: 'Sam Ortega',
    role: 'Nutrition scientist · sample profile',
    bio: 'Helps turn daily check-ins into questions worth asking, without treating them as lab results.',
    fullBio: ['Sam is a synthetic profile. A published profile would list approved credentials and affiliations here.'],
    focus: ['Daily log'],
    portrait: { kind: 'shortRod', seed: 15, color: C.clay },
  },
  {
    slug: 'nandini-rao',
    name: 'Nandini Rao',
    role: 'Lab quality manager · sample profile',
    bio: 'Looks after the checks a sample passes before any result is released for review.',
    fullBio: [
      'Nandini is a synthetic profile used to give the homepage rail enough cards to page at desktop width.',
      'A published profile would describe the quality steps in plain terms and link to the lab’s accreditation statement once approved.',
    ],
    focus: ['Lab', 'Quality'],
    portrait: { kind: 'hairy', seed: 16, color: C.gut },
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    excerpt: 'The kit instructions were short and clear. I knew what to do before I opened the pouch.',
    attribution: 'Sample customer',
    context: 'Gut kit · synthetic quote',
  },
  {
    id: 't2',
    excerpt:
      'I liked that the report told me what it could not say as clearly as what it could. The limitations section was the part I read twice, and it made the rest easier to trust.',
    full: [
      'I liked that the report told me what it could not say as clearly as what it could. The limitations section was the part I read twice, and it made the rest easier to trust.',
      'This is a synthetic testimonial written to check how a long excerpt clamps on the card and opens in full in the reading view.',
    ],
    attribution: 'Sample customer',
    context: 'Skin kit · synthetic quote',
  },
  {
    id: 't3',
    excerpt: 'Checking in took less than a minute.',
    attribution: 'Sample customer',
    context: 'Daily log · synthetic quote',
  },
  {
    id: 't4',
    excerpt:
      'Returning the sample was the step I worried about. The tracking updates meant I never had to wonder where it was, and support answered my one question the same day.',
    full: [
      'Returning the sample was the step I worried about. The tracking updates meant I never had to wonder where it was, and support answered my one question the same day.',
      'Synthetic testimonial: published quotes need the customer’s permission and approval before they appear.',
    ],
    attribution: 'Sample customer with a much longer display name',
    context: 'Vaginal kit · synthetic quote',
  },
  {
    id: 't5',
    excerpt: 'Seeing my own check-ins next to, but separate from, the lab report helped me prepare questions for my doctor.',
    attribution: 'Sample customer',
    context: 'Progress · synthetic quote',
  },
];

export const REVIEW_SETS: ReviewSet[] = [
  {
    productSlug: 'sample-storage-pouch',
    reviews: [
      {
        id: 'r1',
        rating: 5,
        title: 'Sturdy and easy to seal',
        body: 'The pouch closed properly first time and the label space was big enough to write on clearly. Synthetic review for layout only.',
        author: 'Sample reviewer',
        date: '2026-10-02',
      },
      {
        id: 'r2',
        rating: 4,
        title: 'Does the job',
        body: 'Fits the collection tube with room to spare. I would have liked the instructions printed on the pouch itself rather than on a separate card, but that is a small thing and it did not stop me from getting the sample back on time. Synthetic review written long on purpose to check the excerpt clamp and the full reading view.',
        author: 'Sample reviewer',
        date: '2026-09-21',
      },
      {
        id: 'r3',
        rating: 5,
        title: 'Clear',
        body: 'Simple. Synthetic review.',
        author: 'Sample reviewer',
        date: '2026-09-11',
      },
      {
        id: 'r4',
        rating: 3,
        title: 'Smaller than I expected',
        body: 'Works, but the larger size would suit me better. Synthetic review for layout only.',
        author: 'Sample reviewer with a longer name',
        date: '2026-08-30',
      },
      {
        id: 'r5',
        rating: 4,
        title: 'Good seal, quick delivery',
        body: 'Arrived with the kit and was straightforward to use. Synthetic review for layout only.',
        author: 'Sample reviewer',
        date: '2026-08-14',
      },
    ],
  },
];

export interface RatingSummary {
  average: number;
  count: number;
  /** Count per star, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
}

/** Preview-only aggregate computed from the local sample set (the server owns real counts). */
export function summarize(reviews: Review[]): RatingSummary | null {
  if (!reviews.length) return null;
  const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of reviews) {
    distribution[r.rating - 1] += 1;
    sum += r.rating;
  }
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length, distribution };
}

export function reviewsFor(slug: string): Review[] {
  return REVIEW_SETS.find((s) => s.productSlug === slug)?.reviews ?? [];
}

export function expertBySlug(slug: string): Expert | undefined {
  return EXPERTS.find((e) => e.slug === slug);
}
