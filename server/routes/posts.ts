import { Hono } from 'hono';

import { db } from '@/adapter.ts';
import type { Context } from '@/db/context.ts';
import { postsTable } from '@/db/schemas/posts.ts';
import { loggedIn } from '@/middleware/loggedIn.ts';
import { zValidator } from '@hono/zod-validator';

import {
  createPostSchema,
  type ErrorResponse,
  type SuccessResponse,
} from '@/shared/types.ts';

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
  .get('/', loggedIn, async (c) => {});
