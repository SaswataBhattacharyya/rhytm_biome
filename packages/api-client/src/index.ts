import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

export function createDailyClient(baseUrl: string, accessToken: () => string | Promise<string>) {
  const client = createClient<paths>({ baseUrl });
  client.use({
    async onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${await accessToken()}`);
    },
  });
  return client;
}

export type { paths, components } from './schema.js';
