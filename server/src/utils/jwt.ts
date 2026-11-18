import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface TokenPayload {
  sub: string; // user id
  tv: number;  // token_version, lets us revoke all tokens for a user
}

export function signToken(userId: string, tokenVersion: number) {
  const payload: TokenPayload = { sub: userId, tv: tokenVersion };
  return jwt.sign(payload, env().JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env().JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Throws on invalid/expired tokens. Pins the algorithm to block alg-confusion attacks. */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || typeof decoded.sub !== 'string' || typeof decoded.tv !== 'number') {
    throw new Error('Malformed token');
  }
  return { sub: decoded.sub, tv: decoded.tv };
}
