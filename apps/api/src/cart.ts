import { randomUUID } from 'node:crypto';
import { Body, ConflictException, Controller, Delete, Get, Headers, Inject, NotFoundException, Param, Post, Put, Query, UnprocessableEntityException } from '@nestjs/common';
import type { components } from '@rb/api-client';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { idempotencyKey } from './daily-contract.js';
import { UserId, validated } from './request.js';
import { DailyStore } from './store.js';

type Cart = components['schemas']['Cart'];
type Line = components['schemas']['CartLine'];
const uuid = z.uuid();
const revision = z.number().int().min(1).max(2147483647);
const removeQuery = z.object({ base_revision: z.string().regex(/^\d{1,10}$/).transform(Number).pipe(revision) }).strict();
const lineInput = z.object({
  kind: z.enum(['test', 'sku']),
  subject_id: uuid,
  quantity: z.number().int().min(1).max(10),
  base_revision: revision,
}).strict();

@Controller('v1/carts')
export class CartController {
  constructor(@Inject(DailyStore) private readonly store: DailyStore) {}

  @Post()
  async open(@UserId() user: string, @Headers('idempotency-key') header: unknown) {
    const key = validated(idempotencyKey, header);
    const data = await this.store.forUser(user, client => this.store.mutateOnce(client, user, 'cart_open', key, {}, async () => {
      await client.query(
        'insert into rb_private.sandbox_carts (user_id, id) values ($1, $2) on conflict (user_id) do nothing',
        [user, randomUUID()],
      );
      return this.read(client, user);
    }));
    return { data };
  }

  @Get(':id')
  async get(@UserId() user: string, @Param('id') id: string) {
    const cartId = validated(uuid, id);
    return { data: await this.store.forUser(user, client => this.read(client, user, cartId)) };
  }

  @Put(':id/items/:lineId')
  put(@UserId() user: string, @Param('id') id: string, @Param('lineId') lineId: string,
    @Headers('idempotency-key') header: unknown, @Body() body: unknown) {
    const { base_revision, ...input } = validated(lineInput, body);
    return this.change(user, id, lineId, header, base_revision, input);
  }

  @Delete(':id/items/:lineId')
  remove(@UserId() user: string, @Param('id') id: string, @Param('lineId') lineId: string,
    @Headers('idempotency-key') header: unknown, @Query() query: unknown) {
    return this.change(user, id, lineId, header, validated(removeQuery, query).base_revision, null);
  }

  private async read(client: PoolClient, user: string, id?: string) {
    const { rows: [cart] } = await client.query<Cart>(
      `select id, revision, 'INR' as currency, items from rb_private.sandbox_carts
       where user_id = $1 and ($2::uuid is null or id = $2)`, [user, id ?? null],
    );
    if (!cart) throw new NotFoundException('Cart not found.');
    return cart;
  }

  private async change(user: string, id: string, lineId: string, header: unknown, base: number, input: Omit<z.infer<typeof lineInput>, 'base_revision'> | null) {
    const cartId = validated(uuid, id);
    const lineKey = validated(uuid, lineId);
    const key = validated(idempotencyKey, header);
    const data = await this.store.forUser(user, client => this.store.mutateOnce(
      client, user, 'cart_change', key, { cartId, lineKey, base, input }, async () => {
        const cart = await this.read(client, user, cartId);
        if (cart.revision !== base) {
          throw new ConflictException({ code: 'REVISION_CONFLICT', message: 'Reload the current cart before retrying.' });
        }
        const existing = cart.items.find(line => line.line_id === lineKey);
        const items = cart.items.filter(line => line.line_id !== lineKey);
        if (input) {
          if ((existing && (existing.kind !== input.kind || existing.subject_id !== input.subject_id)) ||
              items.some(line => line.kind === input.kind && line.subject_id === input.subject_id)) {
            throw new ConflictException({ code: 'CART_LINE_CONFLICT', message: 'Use the existing cart line for this item.' });
          }
          if (items.length >= 30) throw new UnprocessableEntityException('The cart holds at most 30 distinct items.');
          const details = await this.itemDetails(client, input);
          const line = { line_id: lineKey, ...input, ...details };
          if (existing) items.splice(cart.items.indexOf(existing), 0, line);
          else items.push(line);
        } else if (!existing) {
          throw new NotFoundException('Cart line not found.');
        }
        const { rows: [updated] } = await client.query<Cart>(
          `update rb_private.sandbox_carts set items = $2, revision = revision + 1
           where user_id = $1 returning id, revision, 'INR' as currency, items`, [user, JSON.stringify(items)],
        );
        return updated;
      },
    ));
    return { data };
  }

  private async itemDetails(client: PoolClient, input: Pick<Line, 'kind' | 'subject_id'>) {
    type Details = Pick<Line, 'title' | 'option_label' | 'unit_price_paise'>;
    const { rows: [details] } = await client.query<Details>(
      input.kind === 'test'
        ? `select document ->> 'title' as title, document -> 'price_paise' as unit_price_paise
           from rb_private.catalogue_entries where kind = 'test' and lookup_key = $1 and published`
        : `select document ->> 'title' as title, sku ->> 'size_label' as option_label,
                  sku -> 'price_paise' as unit_price_paise
           from rb_private.catalogue_entries,
           lateral jsonb_array_elements(document -> 'skus') as sku
           where kind = 'product' and published and sku ->> 'id' = $1 and sku -> 'available' = 'true'::jsonb limit 1`,
      [input.subject_id],
    );
    if (!details || !details.title || !Number.isSafeInteger(details.unit_price_paise) || details.unit_price_paise < 0) {
      throw new UnprocessableEntityException({ code: 'ITEM_UNAVAILABLE', message: 'This item is unavailable.' });
    }
    return details;
  }
}
