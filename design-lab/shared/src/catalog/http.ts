/**
 * Connected catalogue adapter — public GET routes from 18_OPENAPI.yaml.
 * No auth header (browse without signing in). 404 → null.
 */
/// <reference lib="dom" />
import { CatalogError, type CatalogSource } from './source';
import type { CatalogDetail, CatalogList, Product, TestType } from './types';

export function createHttpCatalog(cfg: { apiBase: string; fetch?: typeof fetch; timeoutMs?: number }): CatalogSource {
  const base = cfg.apiBase.replace(/\/+$/, '');
  const doFetch = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const timeoutMs = cfg.timeoutMs ?? 15000;

  async function get<T>(path: string, allow404: boolean): Promise<T | null> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res: Response;
    try {
      res = await doFetch(base + path, { headers: { Accept: 'application/json' }, signal: ctrl?.signal });
    } catch {
      throw new CatalogError('network', 'Couldn’t reach the catalogue.');
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res.status === 404 && allow404) return null;
    if (!res.ok) throw new CatalogError('unavailable', 'The catalogue is temporarily unavailable.', res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new CatalogError('unavailable', 'Unexpected catalogue response.', res.status);
    }
  }

  return {
    mode: 'connected',
    label: (() => {
      try {
        return new URL(base).host;
      } catch {
        return base;
      }
    })(),
    async listTests() {
      return (await get<CatalogList<TestType>>('/v1/catalog/tests', false))!.data;
    },
    async getTest(id) {
      return (await get<CatalogDetail<TestType>>(`/v1/catalog/tests/${encodeURIComponent(id)}`, true))?.data ?? null;
    },
    async listProducts() {
      return (await get<CatalogList<Product>>('/v1/catalog/products', false))!.data;
    },
    async getProduct(slug) {
      return (await get<CatalogDetail<Product>>(`/v1/catalog/products/${encodeURIComponent(slug)}`, true))?.data ?? null;
    },
  };
}
