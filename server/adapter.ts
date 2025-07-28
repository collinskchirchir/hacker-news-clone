import { drizzle } from 'drizzle-orm/postgres-js';

import { sessionTable, userRelations, userTable } from '@/db/schemas/auth.ts';
import { commentRelations, commentsTable } from '@/db/schemas/comments.ts';
import { postRelations, postsTable } from '@/db/schemas/posts.ts';
import {
  commentUpvoteRelations,
  commentUpvotesTable,
  postUpvoteRelations,
  postUpvotesTable,
} from '@/db/schemas/upvotes.ts';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import postgres from 'postgres';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const processEnv = EnvSchema.parse(process.env);

const queryClient = postgres(processEnv.DATABASE_URL);

export const db = drizzle(queryClient, {
  schema: {
    user: userTable,
    session: sessionTable,
    posts: postsTable,
    comments: commentsTable,
    postUpvotes: postUpvotesTable,
    commentUpvotes: commentUpvotesTable,
    postRelations,
    commentRelations,
    postUpvoteRelations,
    commentUpvoteRelations,
    userRelations,
  },
});

export const adapter = new DrizzlePostgreSQLAdapter(
  db,
  sessionTable,
  userTable
);
