// EXAMPLE SUCCESS
// const data: SuccessResponse<{id: number}> = {
//   success: true,
//   message: 'Post Created',
//   data: {id: 1}
// };
export type SuccessResponse<T = void> = {
  success: true;
  message: string;
} & (T extends void ? {} : { data: T });

export type ErrorResponse = {
  success: false;
  error: string;
  isFormError?: boolean;
};
