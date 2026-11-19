import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { z } from 'zod';
import { consentChange, dailyLogInput, featureConfig, localDateAt, profilePatch } from './daily-contract.js';

type Profile = {
  user_id: string;
  display_name: string | null;
  timezone: string;
  locale: string;
  onboarding_state: 'pending';
  revision: number;
};

const logFields = `id, to_char(local_date, 'YYYY-MM-DD') as local_date, timezone, revision,
  definition_version_id, status, recorded_at, retrospective, answers, '[]'::jsonb as doses`;

export class DailyStore {
  constructor(private readonly pool: Pool) {}

  async forUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query('begin');
      await client.query("select set_config('rb.user_id', $1, true)", [userId]);
      await client.query('insert into rb_private.profiles (user_id) values ($1) on conflict do nothing', [userId]);
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async profile(client: PoolClient, userId: string, lock = false) {
    const result = await client.query<Profile>(
      'select * from rb_private.profiles where user_id = $1' + (lock ? ' for update' : ''),
      [userId],
    );
    return result.rows[0]!;
  }

  async updateProfile(client: PoolClient, userId: string, patch: z.infer<typeof profilePatch>) {
    const current = await this.profile(client, userId, true);
    if (current.revision !== patch.base_revision) {
      throw new ConflictException({ code: 'REVISION_CONFLICT', message: 'Reload the current profile before retrying.' });
    }
    const result = await client.query<Profile>(
      `update rb_private.profiles set display_name = $2, timezone = $3, locale = $4,
        revision = revision + 1 where user_id = $1 returning *`,
      [userId, patch.display_name === undefined ? current.display_name : patch.display_name,
        patch.timezone ?? current.timezone, patch.locale ?? current.locale],
    );
    return result.rows[0];
  }

  async bootstrap(client: PoolClient, userId: string) {
    const profile = await this.profile(client, userId);
    const now = new Date();
    const { rows } = await client.query<{ status: string }>(
      'select status from rb_private.daily_logs where user_id = $1 and local_date = $2',
      [userId, localDateAt(profile.timezone, now)],
    );
    return {
      profile,
      config: featureConfig,
      next_actions: rows[0]?.status === 'complete' ? [] : [{ kind: 'daily_check_in', label: 'Check in' }],
      active_tests: [],
      active_orders: [],
      today_log_status: rows[0]?.status ?? 'none',
      unread_count: 0,
      as_of: now.toISOString(),
    };
  }

  async consents(client: PoolClient, userId: string, limit = 25, cursor?: string) {
    let before = null;
    if (cursor) {
      const { rows: [marker] } = await client.query(
        'select id from rb_private.consent_events where user_id = $1 and cursor_id = $2',
        [userId, cursor],
      );
      if (!marker) throw new UnprocessableEntityException('Invalid consent history cursor.');
      before = marker.id;
    }
    const { rows } = await client.query(
      `select purpose, policy_version, action, effective_at, cursor_id from rb_private.consent_events
        where user_id = $1 and ($2::bigint is null or id < $2) order by id desc limit $3`,
      [userId, before, limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      data: page.map(({ cursor_id, ...event }) => event),
      meta: { next_cursor: rows.length > limit ? page.at(-1)?.cursor_id : null },
    };
  }

  async changeConsent(client: PoolClient, userId: string, key: string, input: z.infer<typeof consentChange>) {
    return this.mutateOnce(client, userId, 'consent', key, input, async () => {
      const { rows: [event] } = await client.query(
        `insert into rb_private.consent_events (user_id, purpose, policy_version, action)
          values ($1, $2, $3, $4) returning id, effective_at`,
        [userId, input.purpose, input.policy_version, input.action],
      );
      await client.query('insert into rb_private.audit_events (user_id, consent_event_id) values ($1, $2)', [userId, event.id]);
      return { ...input, effective_at: event.effective_at };
    });
  }

  async logForDate(client: PoolClient, userId: string, localDate: string) {
    const { rows } = await client.query(
      `select ${logFields} from rb_private.daily_logs where user_id = $1 and local_date = $2`,
      [userId, localDate],
    );
    if (!rows[0]) throw new NotFoundException('No check-in for this date.');
    return rows[0];
  }

  async recordLog(client: PoolClient, userId: string, localDate: string, key: string, input: z.infer<typeof dailyLogInput>) {
    return this.mutateOnce(client, userId, 'daily_log', key, { localDate, ...input }, async () => {
      const current = await client.query<{ revision: number; timezone: string; retrospective: boolean }>(
        'select revision, timezone, retrospective from rb_private.daily_logs where user_id = $1 and local_date = $2',
        [userId, localDate],
      );
      const previous = current.rows[0];
      if ((previous?.revision ?? 0) !== input.base_revision) {
        throw new ConflictException({ code: 'REVISION_CONFLICT', message: 'Reload the current check-in before retrying.' });
      }
      const zone = previous?.timezone ?? input.timezone;
      const today = localDateAt(zone);
      if (localDate > today || (previous && input.timezone !== zone)) {
        throw new UnprocessableEntityException('Use a valid date and the original timezone when editing a check-in.');
      }
      const { rows } = await client.query(
        `insert into rb_private.daily_logs
          (user_id, local_date, timezone, revision, definition_version_id, status, retrospective, answers)
          values ($1, $2, $3, 1, $4, $5, $6, $7)
          on conflict (user_id, local_date) do update
          set revision = daily_logs.revision + 1, status = excluded.status, answers = excluded.answers
          returning ${logFields}`,
        [userId, localDate, zone, input.definition_version_id, input.status,
          previous?.retrospective ?? localDate < today, JSON.stringify(input.answers)],
      );
      return rows[0];
    }, async () => {
      const { rows } = await client.query<{ action: string }>(
        `select action from rb_private.consent_events where user_id = $1
          and purpose = 'synthetic_daily_logging' and policy_version = 'demo-1' order by id desc limit 1`,
        [userId],
      );
      if (rows[0]?.action !== 'grant') throw new ForbiddenException('Enable synthetic daily logging first.');
    });
  }

  async progress(client: PoolClient, userId: string, from: string, to: string) {
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (days < 1 || days > 366) throw new UnprocessableEntityException('Choose an inclusive range of up to 366 days.');
    const { rows: [counts] } = await client.query(
      `select count(*) filter (where status = 'complete')::int as complete,
              count(*) filter (where status = 'partial')::int as partial
        from rb_private.daily_logs where user_id = $1 and local_date between $2 and $3`,
      [userId, from, to],
    );
    return {
      from, to, as_of: new Date().toISOString(),
      logging: { ...counts, expected: days },
      adherence: { taken: 0, not_taken: 0, skipped: 0, unknown: 0, scheduled: 0 },
      series: [],
      comparable_reports: [],
    };
  }

  async mutateOnce<T>(
    client: PoolClient, userId: string, scope: string, key: string, input: object,
    mutate: () => Promise<T>, authorize?: () => Promise<void>,
  ): Promise<T> {
    await this.profile(client, userId, true);
    await authorize?.();
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const { rows: [receipt] } = await client.query<{ request_hash: string; response: T }>(
      'select request_hash, response from rb_private.mutation_receipts where user_id = $1 and scope = $2 and key = $3',
      [userId, scope, key],
    );
    if (receipt) {
      if (receipt.request_hash !== hash) {
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'This key has already been used for a different change.' });
      }
      return receipt.response;
    }
    const response = await mutate();
    await client.query(
      'insert into rb_private.mutation_receipts (user_id, scope, key, request_hash, response) values ($1, $2, $3, $4, $5)',
      [userId, scope, key, hash, JSON.stringify(response)],
    );
    return response;
  }
}
