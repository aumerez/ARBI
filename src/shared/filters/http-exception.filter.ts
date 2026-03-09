import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();

    const isDev = process.env.NODE_ENV !== 'production';
    let statusCode: number;
    let message: string;
    let shouldIncludeStack = false;

    if (exception instanceof HttpException) {
      // Expected HTTP errors from Nest (400, 401, 403, 404, etc.)
      statusCode = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Error';
      // HttpException: NEVER include stack trace (consistent format)
    } else if (exception.response?.status) {
      // Errors that were manually created with response property (expected errors)
      statusCode = exception.response.status;
      message = exception.message || 'Error';
      // Include stack trace only in development for debugging expected errors
      shouldIncludeStack = isDev && !!exception.stack;
    } else {
      // Truly unknown exceptions (e.g., plain Error without response)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      // Never expose stack trace for unknown errors (security)
    }

    // Build response object - standardized JSON format
    const responseBody: any = {
      statusCode,
      message,
    };

    if (shouldIncludeStack) {
      responseBody.error = exception.stack;
    }

    // Send JSON response
    response.status(statusCode).json(responseBody);
  }
}
