import { relations } from 'drizzle-orm';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { userTable } from '@/db/schemas/auth.ts';
import { commentsTable } from '@/db/schemas/comments.ts';
import { postsTable } from '@/db/schemas/posts.ts';

export const postUpvotesTable = pgTable('post_upvotes', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  postId: integer().notNull(),
  userId: text().notNull(),
  createdAt: timestamp({
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
export const postUpvoteRelations = relations(postUpvotesTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [postUpvotesTable.postId],
    references: [postsTable.id],
    relationName: 'postUpvotes',
  }),
  user: one(userTable, {
    fields: [postUpvotesTable.userId],
    references: [userTable.id],
    relationName: 'user',
  }),
}));

export const commentUpvotesTable = pgTable('comment_upvotes', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  commentId: integer().notNull(),
  userId: text().notNull(),
  createdAt: timestamp({
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const commentUpvoteRelations = relations(
  commentUpvotesTable,
  ({ one }) => ({
    post: one(commentsTable, {
      fields: [commentUpvotesTable.commentId],
      references: [commentsTable.id],
      relationName: 'commentUpvotes',
    }),
    user: one(userTable, {
      fields: [commentUpvotesTable.userId],
      references: [userTable.id],
      relationName: 'user',
    }),
  })
);
