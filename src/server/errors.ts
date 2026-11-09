export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      {
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must contain valid JSON.',
        },
      },
      { status: 400 },
    );
  if (error instanceof Error && error.name === 'ZodError')
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted fields.',
        },
      },
      { status: 400 },
    );
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002' || code === 'P2034')
      return Response.json(
        {
          error: {
            code: 'CONCURRENT_UPDATE',
            message:
              'The order changed while this request was being processed. Refresh and try again.',
          },
        },
        { status: 409 },
      );
    if (code === 'P2023')
      return Response.json(
        { error: { code: 'INVALID_IDENTIFIER', message: 'The supplied identifier is invalid.' } },
        { status: 400 },
      );
  }
  console.error(error);
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 },
  );
}
export const notFound = (message = 'Record not found.') => new AppError('NOT_FOUND', message, 404);
export const conflict = (code: string, message: string) => new AppError(code, message, 409);
