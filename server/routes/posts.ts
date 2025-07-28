import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, asc, countDistinct, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/adapter.ts';
import type { Context } from '@/db/context.ts';
import { userTable } from '@/db/schemas/auth';
import { commentsTable, insertCommentsSchema } from '@/db/schemas/comments.ts';
import { postsTable } from '@/db/schemas/posts.ts';
import { commentUpvotesTable, postUpvotesTable } from '@/db/schemas/upvotes.ts';
import { loggedIn } from '@/middleware/loggedIn.ts';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import {
  createCommentSchema,
  createPostSchema,
  paginationSchema,
  type Comment,
  type ErrorResponse,
  type PaginatedResponse,
  type Post,
  type SuccessResponse,
} from '@/shared/types.ts';
import { getISOFormatDateQuery } from '@/lib/utils.ts';

export const postRouter = new Hono<Context>()
  .post('/', loggedIn, zValidator('form', createPostSchema), async (c) => {
    const { title, content, url } = c.req.valid('form');
    const user = c.get('user')!;
    const [post] = await db
      .insert(postsTable)
      .values({
        title,
        content,
        url,
        userId: user.id,
      })
      .returning({ id: postsTable.id });

    if (!post) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: 'Failed to create post',
        },
        500
      );
    }

    return c.json<SuccessResponse<{ postId: number }>>({
      success: true,
      message: 'Post Created',
      data: {
        postId: post.id,
      },
    });
  })
  .get('/', loggedIn, zValidator('query', paginationSchema), async (c) => {
    const { limit, page, sortBy, order, author, site } = c.req.valid('query');
    const user = c.get('user');

    const offset = (page - 1) * limit;

    const sortByColumn =
      sortBy === 'points' ? postsTable.points : postsTable.createdAt;
    const sortOrder = order === 'desc' ? desc(sortByColumn) : asc(sortByColumn);

    const [count] = await db
      .select({ count: countDistinct(postsTable.id) })
      .from(postsTable)
      // if there's an author or site provided in the search parameters
      .where(
        and(
          author ? eq(postsTable.userId, author) : undefined,
          site ? eq(postsTable.url, site) : undefined
        )
      );

    const postsQuery = db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        points: postsTable.points,
        createdAt: getISOFormatDateQuery(postsTable.createdAt),
        commentCount: postsTable.commentCount,
        author: {
          username: userTable.username,
          id: userTable.id,
        },
        // if user is logged in, check if the post is upvoted by the user. Any post user upvoted in the  postUpvotesTable will have a userId value attached to it from the join
        isUpvoted: user
          ? sql<boolean>`CASE WHEN
          ${postUpvotesTable.userId}
          IS
          NOT
          NULL
          THEN
          true
          ELSE
          false
          END`
          : sql<boolean>`false`,
      })
      .from(postsTable)
      .leftJoin(userTable, eq(postsTable.userId, userTable.id))
      .orderBy(sortOrder)
      .limit(limit)
      .offset(offset)
      // if there's an author or site provided in the search parameters
      .where(
        and(
          author ? eq(postsTable.userId, author) : undefined,
          site ? eq(postsTable.url, site) : undefined
        )
      );
    // left join the postUpvotesTable if the user is logged in
    if (user) {
      postsQuery.leftJoin(
        postUpvotesTable,
        and(
          eq(postUpvotesTable.postId, postsTable.id),
          eq(postUpvotesTable.userId, user.id)
        )
      );
    }
    const posts = await postsQuery;

    return c.json<PaginatedResponse<Post[]>>(
      {
        data: posts as Post[],
        success: true,
        message: 'Posts fetched',
        pagination: {
          page,
          totalPages: Math.ceil((count?.count ?? 0) / limit) as number,
        },
      },
      200
    );
  })
  .post(
    '/:id/upvote',
    loggedIn,
    zValidator('param', z.object({ id: z.coerce.number() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const user = c.get('user')!;

      let pointsChange: -1 | 1 = 1;

      const points = await db.transaction(async (tx) => {
        const [existingUpvote] = await tx
          .select()
          .from(postUpvotesTable)
          .where(
            and(
              eq(postUpvotesTable.postId, id),
              eq(postUpvotesTable.userId, user.id)
            )
          )
          .limit(1);

        pointsChange = existingUpvote ? -1 : 1;

        const [updated] = await tx
          .update(postsTable)
          .set({
            points: sql`${postsTable.points}
            +
            ${pointsChange}`,
          })
          .where(eq(postsTable.id, id))
          .returning({ points: postsTable.points });

        if (!updated) {
          throw new HTTPException(404, {
            message: 'Post not found',
          });
        }

        // handle deleting if already upvoted or add upvotes to table
        if (existingUpvote) {
          await tx
            .delete(postUpvotesTable)
            .where(eq(postUpvotesTable.id, existingUpvote.id));
        } else {
          await tx.insert(postUpvotesTable).values({
            postId: id,
            userId: user.id,
          });
        }
        return updated.points;
      });
      return c.json<SuccessResponse<{ count: number; isUpvoted: boolean }>>(
        {
          success: true,
          message: 'Post updated',
          data: {
            count: points,
            isUpvoted: pointsChange > 0,
          },
        },
        200
      );
    }
  )
  .post(
    '/:postId/comment',
    loggedIn,
    zValidator('param', z.object({ postId: z.coerce.number() })),
    zValidator('form', createCommentSchema),
    async (c) => {
      const { postId } = c.req.valid('param');
      const { content } = c.req.valid('form');
      const user = c.get('user')!;

      const [comment] = await db.transaction(async (tx) => {
        // update comment count on postsTable
        const [updated] = await tx
          .update(postsTable)
          .set({
            commentCount: sql`${postsTable.commentCount}
            + 1`,
          })
          .where(eq(postsTable.id, postId))
          .returning({ commentCount: postsTable.commentCount });
        if (!updated) {
          throw new HTTPException(404, {
            message: 'Post not found',
          });
        }
        return tx
          .insert(commentsTable)
          .values({
            content,
            postId,
            userId: user.id,
          })
          .returning({
            id: commentsTable.id,
            userId: commentsTable.userId,
            postId: commentsTable.postId,
            content: commentsTable.content,
            points: commentsTable.points,
            depth: commentsTable.depth,
            parentCommentId: commentsTable.parentCommentId,
            createdAt: getISOFormatDateQuery(commentsTable.createdAt),
            commentCount: commentsTable.commentCount,
          });
      });
      return c.json<SuccessResponse<Comment>>({
        success: true,
        message: 'Comment created',
        data: {
          ...comment,
          commentUpvotes: [],
          childComments: [],
          author: {
            username: user.username,
            id: user.id,
          },
        } as Comment,
      });
    }
  )
  .get(
    '/:postId/comments',
    zValidator('param', z.object({ postId: z.coerce.number() })),
    zValidator(
      'query',
      paginationSchema.extend({
        includeChildren: z.coerce.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.get('user');
      const { postId } = c.req.valid('param');
      const { limit, page, sortBy, order, includeChildren } =
        c.req.valid('query');

      const offset = (page - 1) * limit;

      const [postExists] = await db
        .select({ exists: sql`1` })
        .from(postsTable)
        .where(eq(postsTable.id, postId))
        .limit(1);
      if (!postExists) {
        throw new HTTPException(404, {
          message: 'Post not found',
        });
      }

      const sortByColumn =
        sortBy === 'points' ? commentsTable.points : commentsTable.createdAt;
      const sortOrder =
        order === 'desc' ? desc(sortByColumn) : asc(sortByColumn);

      // count of top-level comments of a post (not nested comments) for pagination
      const [count] = await db
        .select({ count: countDistinct(commentsTable.id) })
        .from(commentsTable)
        .where(
          and(
            eq(commentsTable.postId, postId),
            isNull(commentsTable.parentCommentId)
          )
        );
      // drizzle query
      const comments = await db.query.comments.findMany({
        where: and(
          eq(commentsTable.postId, postId),
          isNull(commentsTable.parentCommentId)
        ),
        orderBy: sortOrder,
        limit: limit,
        offset: offset,
        with: {
          author: {
            columns: {
              username: true,
              id: true,
            },
          },
          commentUpvotes: {
            columns: { userId: true },
            where: eq(commentUpvotesTable.userId, user?.id ?? ''),
            limit: 1,
          },
          childComments: {
            limit: includeChildren ? 2 : 0,
            with: {
              author: {
                columns: {
                  username: true,
                  id: true,
                },
              },
              commentUpvotes: {
                columns: { userId: true },
                where: eq(commentUpvotesTable.userId, user?.id ?? ''),
                limit: 1,
              },
            },
            orderBy: sortOrder,
            extras: {
              createdAt: getISOFormatDateQuery(commentsTable.createdAt).as(
                'created_at'
              ),
            },
          },
        },
        extras: {
          createdAt: getISOFormatDateQuery(commentsTable.createdAt).as(
            'created_at'
          ),
        },
      });
      return c.json<PaginatedResponse<Comment[]>>(
        {
          success: true,
          message: 'Comments fetched',
          data: comments as Comment[],
          pagination: {
            page,
            totalPages: Math.ceil((count?.count ?? 0) / limit) as number,
          },
        },
        200
      );
    }
  );
