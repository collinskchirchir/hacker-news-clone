import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { ErrorResponse } from '@/shared/types.ts';

const app = new Hono();

app.get('/', (c) => {
  // throw new Error('Unexpected');
  // purposeful exception
  /**
   throw new HTTPException(404, {
   message: 'Post Not Found',
   cause: { form: true },
   });
   */
  return c.text('Hello Hono!');
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const errResponse =
      err.res ??
      c.json<ErrorResponse>(
        {
          success: false,
          error: err.message,
          isFormError:
            err.cause && typeof err.cause === 'object' && 'form' in err.cause
              ? err.cause.form === true
              : false,
        },
        err.status
      );
    return errResponse;
  }
  return c.json<ErrorResponse>(
    {
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Interal Server Error'
          : (err.stack ?? err.message),
    },
    500
  );
});
export default app;
