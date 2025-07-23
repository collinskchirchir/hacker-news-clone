// EXAMPLE SUCCESS
// const data: SuccessResponse<{id: number}> = {
//   success: true,
//   message: 'Post Created',
//   data: {id: 1}
// };
import { insertPostSchema } from '@/db/schemas/posts.ts';
import { z } from 'zod';

export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? {} : { data: T });

export type ErrorResponse = {
  success: false;
  error: string;
  isFormError?: boolean;
};

export const loginSchema = z.object({
  username: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(3).max(255),
});

export const createPostSchema = insertPostSchema
  .pick({
    title: true,
    url: true,
    content: true,
  })
  .refine((data) => data.url || data.content, {
    message: 'Either url or content is required',
    path: ['url', 'content'],
  });

export const sortBySchema = z.enum(['points', 'recent']);
export const orderSchema = z.enum(['asc', 'desc']);

export const paginationSchema = z.object({
  limit: z.coerce.number().optional().default(10),
  page: z.coerce.number().optional().default(1),
  sortBy: sortBySchema.optional().default('points'),
  order: orderSchema.optional().default('desc'),
  author: z.string().optional(),
  site: z.string().optional(),
});

export type Post = {
  id: number;
  title: string | null;
  url: string | null;
  points: number;
  createdAt: string;
  commentCount: number;
  author: {
    username: string;
    id: string;
  };
  isUpvoted: boolean;
};

export type PaginatedResponse<T> = {
  pagination: {
    page: number;
    totalPages: number;
  };
  data: T;
} & Omit<SuccessResponse, 'data'>;
