import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { commentsTable } from '@/db/schemas/comments.ts';
import { postsTable } from '@/db/schemas/posts.ts';
import { commentUpvotesTable, postUpvotesTable } from '@/db/schemas/upvotes.ts';

export const userTable = pgTable('user', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});

export const sessionTable = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => userTable.id),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
    mode: 'date',
  }).notNull(),
});

export const userRelations = relations(userTable, ({ many }) => ({
  posts: many(postsTable, { relationName: 'posts' }),
  comments: many(commentsTable, { relationName: 'author' }),
  postUpvotes: many(postUpvotesTable, { relationName: 'postUpvotes' }),
  commentUpvotes: many(commentUpvotesTable, { relationName: 'commentUpvotes' }),
}));
