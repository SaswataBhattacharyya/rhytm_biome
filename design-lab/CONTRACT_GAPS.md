# D0 contract gaps (for Codex)

D0 uses `@rb-lab/shared/src/fixtures.ts`, which follows `relay/D0_FIXTURE_EXPECTATIONS.md`. These are design fixtures, not API types. No endpoint was invented and `18_OPENAPI.yaml` was not edited or relied on. When each slice starts, these are the fields/operations the D0 screens assume and need from the validated contract.

| Screen / action | Needed field or operation | Current D0 limitation | Proposed behaviour |
|---|---|---|---|
| Home · primary next action | Server-ranked "next action" (type, title, target route, due state) | Hard-coded per fixture state | Bootstrap/home layout returns one prioritised action with a typed destination; client never invents priority |
| Home · last 7 days | Per-day logging coverage enum `recorded / partial / missing` for a date range, with timezone | Static fixture | Coverage aggregate distinguishes missing from absent; no score field |
| Home · active test | Test instance status label + last-updated timestamp + next action | Static fixture; partial-failure simulated | Section-level error so one failed section doesn't fail Home |
| Log · symptoms | Template-driven symptom prompts with stable IDs; explicit `none` vs not-recorded | Two demo labels | Log template endpoint; submission omits unrecorded items (absent key ≠ `none`) |
| Log · routine doses | Routine occurrence IDs for a date; answer enum `taken / notTaken / skipped` | Two demo items | Routine occurrences per date from routines API |
| Log · save | Idempotency key, server ACK, revision number | No network; memory only; acknowledgement says "recorded in this demo" | UI shows "saved" only after ACK; pending until then |
| Log · offline | Native encrypted outbox (B1) | Simulated banner; nothing persisted | Pending badge driven by outbox state |
| Log · conflict | Conflict payload: both revisions, source device label, timestamps | Synthetic second version | Server returns 409-style typed conflict; user chooses; no silent merge |
| Reports · list | Report status enum incl. `processing / in_review / released / corrected / superseded`; release flag | Two fixture cards | Only `released` exposes a link; drafts never return result data to client |
| Report · layout | Typed report section components (summary, diversity, composition, self-reported, limitations, method/specimen/reference version, correction state) | Placeholder sections only | Section shapes from approved template; accessible table for each chart |
| Report · PDF | Signed private download for released report | Button explains limitation | Signed short-lived URL; theme never alters the PDF |
| Settings · theme/motion | (Optional) server-synced UI preferences | Local only (localStorage / AsyncStorage) | Keep local for D0; decide in B0 whether preferences sync |
| Web service panels | Auth-aware return-to destination after sign-in | Stub pages explain limitation | Auth flow preserves intended route (`/account/reports`, `/account/log`, `/account/progress`) |

## Relay 02 — knowledge cards (against `contracts/knowledge-cards.openapi.json`)

| Need | Current D0 behaviour | Request to Codex |
|---|---|---|
| Placeholder cards in D0 | Contract `PublicCard.content.is_placeholder` is `const false`, so public reads can never return the placeholder fixtures. D0 uses a local `DemoKnowledgeRecord` (`status: 'demo_placeholder'`) through a fixture transport | Confirm that D0/preview uses local fixtures only (no public placeholder channel), or define an authenticated preview read |
| Supported illustration refs | Client registry `ILLUSTRATION_REFS` = `hairy_sphere`, `short_rod`, `twin_strand_rod`, `cell_chain`, `note_lens`, `note_log` | Own the canonical ref registry/enum so publish validation and clients agree |
| Scene → content key | `KNOWLEDGE_KEY_BY_MORPHOLOGY` maps the four morphologies to `*_demo` keys | Decide whether keys are fixed per morphology or assigned per illustration variant |
| Missing / unpublished key | Transport resolves `null` → client shows "Content coming soon" | Keep 404 for unpublished keys; no fallback content |
| Locale fallback | None (missing locale = missing card) | Decide fallback policy server-side if any |
| ETag / If-None-Match | Not used by the fixture transport | Client will add conditional GET when the HTTP transport exists |
| Pagination | Fixture honours opaque numeric `cursor`/`limit` | Real cursor stays opaque; client already treats it as such |
