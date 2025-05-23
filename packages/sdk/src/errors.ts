export class HttpError extends Error {
  readonly code?: number;
  readonly traceId?: string;

  constructor(message: string, traceId?: string) {
    super(message);
    this.traceId = traceId;
  }
}

export class UserInputError extends HttpError {
  override code = 400;
  constructor(message: string = "User input error", traceId?: string) {
    super(message, traceId);
  }
}

export class UnauthorizedError extends HttpError {
  override code = 401;
  constructor(message: string = "User is not logged in", traceId?: string) {
    super(message, traceId);
  }
}

export class ForbiddenError extends HttpError {
  override code = 403;
  constructor(
    message: string = "User does not have access to this resource",
    traceId?: string,
  ) {
    super(message, traceId);
  }
}

export class NotFoundError extends HttpError {
  override code = 404;
  constructor(message: string = "Resource not found", traceId?: string) {
    super(message, traceId);
  }
}

export class InternalServerError extends HttpError {
  override code = 500;
  constructor(message: string = "Internal server error", traceId?: string) {
    super(message, traceId);
  }
}

export class WebhookEventIgnoredError extends HttpError {
  override code = 400;
  constructor(message: string = "Event ignored", traceId?: string) {
    super(message, traceId);
  }
}

export const getErrorByStatusCode = (
  statusCode: number,
  message?: string,
  traceId?: string,
) => {
  if (statusCode === 400) {
    return new UserInputError(message, traceId);
  }

  if (statusCode === 401) {
    return new UnauthorizedError(message, traceId);
  }

  if (statusCode === 403) {
    return new ForbiddenError(message, traceId);
  }

  if (statusCode === 404) {
    return new NotFoundError(message, traceId);
  }

  return new InternalServerError(message, traceId);
};
