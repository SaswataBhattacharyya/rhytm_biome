/**
 * Rupee formatting from integer paise, with Indian digit grouping
 * (₹2,499 · ₹1,24,999 · ₹199.50). Implemented without Intl so web and
 * Hermes render identically.
 */
export function formatINR(paise: number): string {
  if (!Number.isFinite(paise)) return '—';
  const neg = paise < 0;
  const abs = Math.round(Math.abs(paise));
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const s = String(rupees);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${neg ? '−' : ''}₹${grouped}${rem ? '.' + String(rem).padStart(2, '0') : ''}`;
}

/** Spoken form for screen readers: "2,499 rupees". */
export function spokenINR(paise: number): string {
  const v = formatINR(paise).replace('₹', '');
  return `${v} rupees`;
}

export const DOMAIN_LABEL: Record<string, string> = {
  gut: 'Gut',
  skin: 'Skin',
  vaginal: 'Vaginal',
};
