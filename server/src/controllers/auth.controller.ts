import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { parseOrThrow } from '../middleware/validate.js';
import { UserModel } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { signToken } from '../utils/jwt.js';
import { LoginSchema, RegisterSchema } from '../validation/schemas.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('focusflow-timing-equaliser', BCRYPT_ROUNDS);

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

export async function register(req: Request, res: Response) {
  const { email, password, name } = parseOrThrow(RegisterSchema, req.body);

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await UserModel.create({ email, password_hash, name: name ?? '' });
  } catch (e) {
    // Unique index is the source of truth (no check-then-insert race).
    if (isDuplicateKey(e)) throw new HttpError(409, 'An account with this email already exists', 'email_taken');
    throw e;
  }

  res.status(201).json({ token: signToken(user.id, user.token_version), user: user.toJSON() });
}

export async function login(req: Request, res: Response) {
  const { email, password } = parseOrThrow(LoginSchema, req.body);

  const user = await UserModel.findOne({ email }).select('+password_hash');
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect email or password', 'invalid_credentials');

  res.json({ token: signToken(user.id, user.token_version), user: user.toJSON() });
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.auth!.userId);
  if (!user) throw new HttpError(404, 'User not found', 'not_found');
  res.json({ user: user.toJSON() });
}

/** Revokes every token for this user (all devices). */
export async function logoutAll(req: Request, res: Response) {
  await UserModel.updateOne({ _id: req.auth!.userId }, { $inc: { token_version: 1 } });
  res.status(204).end();
}
