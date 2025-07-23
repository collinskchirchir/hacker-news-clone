import { Hono } from 'hono';
import { and, asc, countDistinct, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/adapter.ts';
import type { Context } from '@/db/context.ts';
import { userTable } from '@/db/schemas/auth';
import { postsTable } from '@/db/schemas/posts.ts';
import { postUpvotesTable } from '@/db/schemas/upvotes.ts';
import { loggedIn } from '@/middleware/loggedIn.ts';
import { zValidator } from '@hono/zod-validator';

import {
  createPostSchema,
  paginationSchema,
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
  });
