import type { z } from 'zod';
import { HttpError } from '../utils/HttpError.js';

export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Invalid request', 'validation_error', result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}
