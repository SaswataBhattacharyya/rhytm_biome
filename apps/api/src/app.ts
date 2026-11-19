import 'reflect-metadata';
import {
  Body, Catch, Controller, Get, Headers, HttpException, Inject, Module, Param, Patch, Put,
  Query, UnauthorizedException, UnprocessableEntityException, createParamDecorator,
  type ArgumentsHost, type CanActivate, type ExecutionContext, type ExceptionFilter,
} from '@nestjs/common';
import { APP_GUARD, NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Pool } from 'pg';
import { z } from 'zod';
import { consentChange, consentQuery, dailyLogInput, date, idempotencyKey, profilePatch, progressQuery } from './daily-contract.js';
import { CatalogueController, CATALOGUE_POOL, PUBLIC_ROUTE } from './catalogue.js';
import { DailyStore } from './store.js';

type IdentityRequest = { headers: { authorization?: string }; userId?: string };
const UserId = createParamDecorator((_, context: ExecutionContext) =>
  context.switchToHttp().getRequest<IdentityRequest>().userId,
);

export function sessionVerifier(issuer: URL, keySet: JWTVerifyGetKey = createRemoteJWKSet(
  new URL(issuer.href.replace(/\/$/, '') + '/.well-known/jwks.json'),
)) {
  return async (authorization: string | undefined) => {
    const token = authorization?.match(/^Bearer ([\w.-]+)$/i)?.[1];
    if (token) {
      try {
        const { payload } = await jwtVerify(token, keySet, {
          issuer: issuer.href.replace(/\/$/, ''),
          audience: 'authenticated',
          algorithms: ['ES256', 'RS256'],
          requiredClaims: ['exp', 'sub'],
        });
        if (payload.role === 'authenticated' && z.uuid().safeParse(payload.sub).success) return payload.sub!;
      } catch {
        // The response never includes the token or signer diagnostics.
      }
    }
    throw new UnauthorizedException('Sign in to continue.');
  };
}

function validated<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new UnprocessableEntityException('Check the request fields.');
  return result.data;
}

class SessionGuard implements CanActivate {
  private readonly reflector = new Reflector();

  constructor(private readonly verify: ReturnType<typeof sessionVerifier>) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    request.userId = await this.verify(request.headers.authorization);
    return true;
  }
}

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const response = error instanceof HttpException ? error.getResponse() : undefined;
    const details = typeof response === 'object' && response !== null
      ? response as { message?: string; code?: string }
      : {};
    context.getResponse().status(status).send({
      error: {
        code: details.code ?? ({ 400: 'INVALID_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
          404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'VALIDATION_FAILED' } as Record<number, string>)[status] ?? 'UNAVAILABLE',
        message: typeof details.message === 'string' && status < 500 ? details.message : 'Request temporarily unavailable.',
        request_id: context.getRequest().id,
      },
    });
  }
}

@Controller('v1/me')
class MeController {
  constructor(@Inject(DailyStore) private readonly store: DailyStore) {}

  @Get()
  profile(@UserId() user: string) {
    return this.run(user, client => this.store.profile(client, user));
  }

  @Patch()
  updateProfile(@UserId() user: string, @Body() body: unknown) {
    const input = validated(profilePatch, body);
    return this.run(user, client => this.store.updateProfile(client, user, input));
  }

  @Get('bootstrap')
  bootstrap(@UserId() user: string) {
    return this.run(user, client => this.store.bootstrap(client, user));
  }

  @Get('consents')
  consents(@UserId() user: string, @Query() query: unknown) {
    const { limit, cursor } = validated(consentQuery, query);
    return this.store.forUser(user, client => this.store.consents(client, user, limit, cursor));
  }

  @Put('consents')
  consent(@UserId() user: string, @Headers('idempotency-key') header: unknown, @Body() body: unknown) {
    const key = validated(idempotencyKey, header);
    const input = validated(consentChange, body);
    return this.run(user, client => this.store.changeConsent(client, user, key, input));
  }

  @Get('logs/:localDate')
  log(@UserId() user: string, @Param('localDate') param: unknown) {
    const localDate = validated(date, param);
    return this.run(user, client => this.store.logForDate(client, user, localDate));
  }

  @Put('logs/:localDate')
  recordLog(@UserId() user: string, @Param('localDate') param: unknown, @Headers('idempotency-key') header: unknown, @Body() body: unknown) {
    const localDate = validated(date, param);
    const key = validated(idempotencyKey, header);
    const input = validated(dailyLogInput, body);
    return this.run(user, client => this.store.recordLog(client, user, localDate, key, input));
  }

  @Get('progress')
  progress(@UserId() user: string, @Query() query: unknown) {
    const { from, to } = validated(progressQuery, query);
    return this.run(user, client => this.store.progress(client, user, from, to));
  }

  private async run<T>(user: string, work: (client: import('pg').PoolClient) => Promise<T>) {
    return { data: await this.store.forUser(user, work) };
  }
}

export async function createApp(pool: Pool, verify: ReturnType<typeof sessionVerifier>, webOrigin?: string) {
  @Module({
    controllers: [MeController, CatalogueController],
    providers: [
      { provide: CATALOGUE_POOL, useValue: pool },
      { provide: DailyStore, useValue: new DailyStore(pool) },
      { provide: APP_GUARD, useValue: new SessionGuard(verify) },
    ],
  })
  class ApiModule {}

  const adapter = new FastifyAdapter({ bodyLimit: 16384 });
  adapter.getInstance().addHook('onRequest', (_request, reply, done) => {
    reply.header('Cache-Control', 'private, no-store');
    done();
  });
  const app = await NestFactory.create<NestFastifyApplication>(ApiModule, adapter, { logger: false, abortOnError: false });
  if (webOrigin) app.enableCors({ origin: webOrigin, allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] });
  app.useGlobalFilters(new ApiErrors());
  return app;
}
