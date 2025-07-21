import { relations } from 'drizzle-orm';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { userTable } from '@/db/schemas/auth.ts';
import { postsTable } from '@/db/schemas/posts.ts';
import { commentUpvotesTable } from '@/db/schemas/upvotes.ts';

export const commentsTable = pgTable('comments', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: text().notNull(),
  postId: text().notNull(),
  parentCommentId: integer(),
  content: text().notNull(),
  depth: integer().default(0).notNull(),
  commentCount: integer().default(0).notNull(),
  point: integer().default(0).notNull(),
  createdAt: timestamp({
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp({
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const commentRelations = relations(commentsTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [commentsTable.userId],
    references: [userTable.id],
    relationName: 'author',
  }),
  parentComment: one(commentsTable, {
    fields: [commentsTable.parentCommentId],
    references: [commentsTable.id],
    relationName: 'childComments',
  }),
  childComments: many(commentsTable, {
    relationName: 'childComments',
  }),
  post: one(postsTable, {
    fields: [commentsTable.postId],
    references: [postsTable.id],
  }),
  commentUpvotes: many(commentUpvotesTable, { relationName: 'commentUpvotes' }),
}));
