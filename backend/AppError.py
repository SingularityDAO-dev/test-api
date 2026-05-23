export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}