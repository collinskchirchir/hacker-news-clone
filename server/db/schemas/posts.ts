import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

import { userTable } from '@/db/schemas/auth.ts';
import { commentsTable } from '@/db/schemas/comments.ts';
import { postUpvotesTable } from '@/db/schemas/upvotes.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const postsTable = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  content: text('content'),
  points: integer('points').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: timestamp('created_at', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const insertPostSchema = createInsertSchema(postsTable, {
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters long' }),
  url: z
    .url({ message: 'URL must be a valid URL' })
    .trim()
    .optional()
    .nullish(),
  content: z
    .string()
    .min(3, { message: 'Content must be at least 3 characters long' })
    .trim()
    .optional()
    .nullish(),
});

export const postRelations = relations(postsTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [postsTable.userId],
    references: [userTable.id],
    relationName: 'author',
  }),
  postUpvotesTable: many(postUpvotesTable, { relationName: 'postUpvotes' }),
  comments: many(commentsTable),
}));
