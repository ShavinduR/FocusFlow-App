import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { UserModel } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { verifyToken } from '../utils/jwt.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Missing bearer token', 'unauthorized');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token', 'unauthorized');
  }
  if (!isValidObjectId(payload.sub)) throw new HttpError(401, 'Invalid token subject', 'unauthorized');

  // One indexed read per request so deleted users / revoked tokens are rejected immediately.
  const user = await UserModel.findById(payload.sub).select('token_version').lean();
  if (!user || user.token_version !== payload.tv) {
    throw new HttpError(401, 'Session is no longer valid', 'unauthorized');
  }

  req.auth = { userId: payload.sub };
  next();
}
