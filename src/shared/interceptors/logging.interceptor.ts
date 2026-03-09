import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse<any>();

    const startTime = Date.now();

    // Capture initial request data
    const method = req.method;
    const url = req.url;

    // Process the request and tap into the response stream
    return next.handle().pipe(
      tap({
        // This runs when response completes (success or error)
        // Note: Using 'response' event equivalent via RxJS tap
        // The actual response completion triggers this
        next: () => {
          // Calculate duration
          const duration = Date.now() - startTime;
          const status = res.statusCode || 200;
          const contentLength = res.get ? res.get('content-length') : null;

          // Extract context from request
          // user_id and tenant_id should be set by JwtAuthGuard and TenantValidationMiddleware
          const user = req.user as { sub?: number } | undefined;
          const tenant = req.tenant as { id?: number } | undefined;

          const logData: any = {
            method,
            url,
            status,
            duration_ms: duration,
            content_length: contentLength ? parseInt(contentLength, 10) : null,
          };

          if (user && user.sub) {
            logData.user_id = user.sub;
          }

          if (tenant && tenant.id) {
            logData.tenant_id = tenant.id;
          }

          // Structured logging - output as JSON for log aggregation systems
          // Format: message (string), context (structured data)
          console.log('HTTP request completed', logData);
        },
      }),
    );
  }
}
