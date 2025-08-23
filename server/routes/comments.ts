import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/adapter.ts';
import type { Context } from '@/db/context.ts';
import { commentsTable } from '@/db/schemas/comments.ts';
import { postsTable } from '@/db/schemas/posts.ts';
import { loggedIn } from '@/middleware/loggedIn.ts';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import {
  createCommentSchema,
  type Comment,
  type SuccessResponse,
} from '@/shared/types.ts';
import { getISOFormatDateQuery } from '@/lib/utils.ts';

export const commentsRouter = new Hono<Context>().post(
  '/:id',
  loggedIn,
  zValidator('param', z.object({ id: z.coerce.number() })),
  zValidator('form', createCommentSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { content } = c.req.valid('form');
    const user = c.get('user')!;

    const [comment] = await db.transaction(async (tx) => {
      const [parentComment] = await tx
        .select({
          id: commentsTable.id,
          postId: commentsTable.postId,
          depth: commentsTable.depth,
        })
        .from(commentsTable)
        .where(eq(commentsTable.id, id))
        .limit(1);
      if (!parentComment) {
        throw new HTTPException(404, {
          message: 'Comment not found',
        });
      }
      const postId = parentComment.postId;

      const [updateParentComment] = await tx
        .update(commentsTable)
        .set({
          commentCount: sql`${commentsTable.commentCount}
          + 1`,
        })
        .where(eq(commentsTable.id, parentComment.id))
        .returning({ commentCount: commentsTable.commentCount });

      const [updatedPost] = await tx
        .update(postsTable)
        .set({
          commentCount: sql`${postsTable.commentCount}
          + 1`,
        })
        .where(eq(postsTable.id, postId))
        .returning({ commentCount: postsTable.commentCount });

      if (!updateParentComment || !updatedPost) {
        throw new HTTPException(404, {
          message: 'Error creating comment',
        });
      }

      return tx
        .insert(commentsTable)
        .values({
          content,
          postId,
          userId: user.id,
          parentCommentId: parentComment.id,
          depth: parentComment.depth + 1,
        })
        .returning({
          id: commentsTable.id,
          userId: commentsTable.userId,
          postId: commentsTable.postId,
          content: commentsTable.content,
          points: commentsTable.points,
          depth: commentsTable.depth,
          parentCommentId: commentsTable.parentCommentId,
          createdAt: getISOFormatDateQuery(commentsTable.createdAt).as(
            'created_at'
          ),
          commentCount: commentsTable.commentCount,
        });
    });
    return c.json<SuccessResponse<Comment>>({
      success: true,
      message: 'Comment Created',
      data: {
        ...comment,
        childComments: [],
        commentUpvotes: [],
        author: {
          username: user.username,
          id: user.id,
        },
      } as Comment,
    });
  }
);
