import { createParamDecorator, UnprocessableEntityException, type ExecutionContext } from '@nestjs/common';
import type { z } from 'zod';

export type IdentityRequest = { headers: { authorization?: string }; userId?: string };
export const UserId = createParamDecorator((_, context: ExecutionContext) =>
  context.switchToHttp().getRequest<IdentityRequest>().userId,
);

export function validated<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new UnprocessableEntityException('Check the request fields.');
  return result.data;
}
