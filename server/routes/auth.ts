import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';

import { db } from '@/adapter.ts';
import type { Context } from '@/db/context.ts';
import { userTable } from '@/db/schemas/auth.ts';
import { lucia } from '@/lucia.ts';
import { loggedIn } from '@/middleware/loggedIn.ts';
import { zValidator } from '@hono/zod-validator';
import { generateId } from 'lucia';
import postgres from 'postgres';

import { loginSchema, type SuccessResponse } from '@/shared/types.ts';

export const authRouter = new Hono<Context>()
  .post('/signup', zValidator('form', loginSchema), async (c) => {
    const { username, password } = c.req.valid('form');
    const passwordHash = await Bun.password.hash(password);
    const userId = generateId(15);

    try {
      // Insert the new user into the database with a unique id, username, and hashed password
      await db.insert(userTable).values({
        id: userId,
        username,
        passwordHash,
      });
      // Create a new session for the user
      const session = await lucia.createSession(userId, { username });
      // Serialize the session into a cookie and set it in the response header
      const sessionCookie = lucia.createSessionCookie(session.id).serialize();
      c.header('Set-Cookie', sessionCookie, { append: true });
      // Return a JSON response indicating the user was created successfully
      return c.json<SuccessResponse>(
        {
          success: true,
          message: 'User Created',
        },
        201
      );
    } catch (error) {
      // If the username already exists in the database (unique constraint violation)
      // '23505' is the Postgres error code for unique constraint violation
      if (error instanceof postgres.PostgresError && error.code === '23505') {
        // Return a 409 Conflict error indicating the username is already used
        throw new HTTPException(409, { message: 'Username already used' });
      }
    }
  })
  .post('/login', zValidator('form', loginSchema), async (c) => {
    const { username, password } = c.req.valid('form');

    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.username, username))
      .limit(1);

    if (!existingUser) {
      throw new HTTPException(401, {
        message: 'Incorrect Username',
      });
    }

    const validPassword = await Bun.password.verify(
      password,
      existingUser.passwordHash
    );
    if (!validPassword) {
      throw new HTTPException(401, {
        message: 'Incorrect password',
      });
    }
    // Create a new session for the user
    const session = await lucia.createSession(existingUser.id, { username });
    // Serialize the session into a cookie and set it in the response header
    const sessionCookie = lucia.createSessionCookie(session.id).serialize();
    c.header('Set-Cookie', sessionCookie, { append: true });
    // Return a JSON response indicating the user was created successfully
    return c.json<SuccessResponse>(
      {
        success: true,
        message: 'Logged in',
      },
      200
    );
  })
  .get('/logout', async (c) => {
    const session = c.get('session');
    if (!session) {
      return c.redirect('/');
    }
    await lucia.invalidateSession(session.id);
    c.header('Set-Cookie', lucia.createBlankSessionCookie().serialize());
    return c.redirect('/');
  })
  .get('/user', loggedIn, async (c) => {
    const user = c.get('user')!;
    return c.json<SuccessResponse<{ username: string }>>({
      success: true,
      message: 'User fetched',
      data: {
        username: user.username,
      },
    });
  });
