// workers/api/src/auth/schema.js
// Lược đồ Drizzle cho các bảng của Better Auth, khớp từng cột với db/migrations/0001_auth.sql + 0006.
// Thời gian lưu mili-giây (INTEGER) như mọi bảng ứng dụng; boolean lưu 0/1.
// Bảng ứng dụng (profile, journey, kusala_entry…) vẫn dùng câu lệnh D1 trực tiếp; Drizzle chỉ phục vụ Better Auth.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const ms = (name) => integer(name, { mode: 'timestamp_ms' });
const bool = (name) => integer(name, { mode: 'boolean' });

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: bool('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: ms('createdAt').notNull(),
  updatedAt: ms('updatedAt').notNull(),
  isAnonymous: bool('isAnonymous').default(false),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: ms('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: ms('createdAt').notNull(),
  updatedAt: ms('updatedAt').notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: ms('accessTokenExpiresAt'),
  refreshTokenExpiresAt: ms('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: ms('createdAt').notNull(),
  updatedAt: ms('updatedAt').notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ms('expiresAt').notNull(),
  createdAt: ms('createdAt').notNull(),
  updatedAt: ms('updatedAt').notNull(),
});

export const passkey = sqliteTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('publicKey').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credentialID').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('deviceType').notNull(),
  backedUp: bool('backedUp').notNull(),
  transports: text('transports'),
  createdAt: ms('createdAt'),
  aaguid: text('aaguid'),
});
