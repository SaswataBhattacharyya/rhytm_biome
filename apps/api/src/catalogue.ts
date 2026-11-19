import { Controller, Get, Inject, NotFoundException, Param, Query, SetMetadata, UnprocessableEntityException } from '@nestjs/common';
import type { components } from '@rb/api-client';
import type { Pool } from 'pg';
import { z } from 'zod';

export const PUBLIC_ROUTE = Symbol('public route');
export const CATALOGUE_POOL = Symbol('catalogue pool');

type Items = {
  test: components['schemas']['TestType'];
  product: components['schemas']['Product'];
};

const testKey = z.uuid();
const productKey = z.string().min(1).max(160);
const page = z.object({
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(100),
  cursor: z.string().min(1).max(160).optional(),
}).strict();

@SetMetadata(PUBLIC_ROUTE, true)
@Controller('v1/catalog')
export class CatalogueController {
  constructor(@Inject(CATALOGUE_POOL) private readonly pool: Pool) {}

  @Get('tests')
  tests(@Query() query: unknown) {
    return this.list('test', query, testKey);
  }

  @Get('tests/:key')
  test(@Param('key') key: string) {
    return this.detail('test', key, testKey);
  }

  @Get('products')
  products(@Query() query: unknown) {
    return this.list('product', query, productKey);
  }

  @Get('products/:key')
  product(@Param('key') key: string) {
    return this.detail('product', key, productKey);
  }

  private async list<K extends keyof Items>(kind: K, query: unknown, keySchema: z.ZodType<string>) {
    const parsed = page.safeParse(query);
    if (!parsed.success || (parsed.data.cursor !== undefined && !keySchema.safeParse(parsed.data.cursor).success)) {
      throw new UnprocessableEntityException('Check the catalogue cursor and limit.');
    }
    const { cursor, limit } = parsed.data;
    const { rows } = await this.pool.query<{ lookup_key: string; document: Items[K] }>(
      `select lookup_key, document from rb_private.catalogue_entries
       where kind = $1 and published and ($2::text is null or lookup_key > $2)
       order by lookup_key limit $3`,
      [kind, cursor ?? null, limit + 1],
    );
    const items = rows.slice(0, limit);
    return { data: items.map(row => row.document), meta: { next_cursor: rows.length > limit ? items[limit - 1].lookup_key : null } };
  }

  private async detail<K extends keyof Items>(kind: K, key: string, keySchema: z.ZodType<string>) {
    if (!keySchema.safeParse(key).success) throw new NotFoundException('Catalogue item not found.');
    const { rows: [row] } = await this.pool.query<{ document: Items[K] }>(
      `select document from rb_private.catalogue_entries where kind = $1 and lookup_key = $2 and published`,
      [kind, key],
    );
    if (!row) throw new NotFoundException('Catalogue item not found.');
    return { data: row.document };
  }
}
