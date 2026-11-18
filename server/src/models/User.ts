import { Schema, model, type HydratedDocument } from 'mongoose';

export interface User {
  email: string;
  name: string;
  password_hash: string;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: { type: String, trim: true, maxlength: 100, default: '' },
    // Never returned by default: queries must opt in with .select('+password_hash').
    password_hash: { type: String, required: true, select: false },
    // Bump to invalidate every JWT issued so far (e.g. "log out all devices").
    token_version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.password_hash;
        delete ret.token_version;
        return ret;
      },
    },
  },
);

export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
