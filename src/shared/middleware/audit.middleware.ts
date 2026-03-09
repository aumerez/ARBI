import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditLoggingService } from '../services/audit-logging.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  // Configurable: paths to capture request/response body (for debugging/traceability)
  private readonly captureBodyPaths = [
    '/api/chat',
    '/api/documents',
  ];

  constructor(
    private readonly auditService: AuditLoggingService,
    private readonly databaseService: DatabaseService
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Capture basic request data
    const method = req.method;
    const path = req.path;
    const query = req.query;
    const headers = req.headers;

    // Determine if we should capture body (configurable, size-limited)
    const shouldCaptureBody = this.shouldCaptureBody(path);
    let requestBody: any = undefined;
    if (shouldCaptureBody && req.body) {
      try {
        // Limit to 1KB to avoid storage bloat
        const bodyStr = JSON.stringify(req.body);
        requestBody = bodyStr.length > 1024 ? bodyStr.substring(0, 1024) + '...' : req.body;
      } catch (e) {
        this.logger.debug('Failed to stringify request body for audit', e);
      }
    }

    // Capture response on finish event
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const responseSize = res.get('content-length')
          ? parseInt(res.get('content-length')!, 10)
          : null;

        // Extract user ID from JWT payload if authenticated
        const userId = req.user && (req.user as any).sub ? (req.user as any).sub : undefined;

        // Build audit payload
        const auditPayload: any = {
          method,
          path,
          status,
          duration_ms: duration,
          response_size: responseSize,
        };

        // Add query if present
        if (Object.keys(query).length > 0) {
          auditPayload.query = query;
        }

        // Add request body if captured
        if (requestBody) {
          auditPayload.request_body = requestBody;
        }

        // Add response snippet for specific paths (configurable)
        if (shouldCaptureBody && res.locals.bodySnippet) {
          auditPayload.response_snippet = res.locals.bodySnippet;
        }

        // Log the audit event
        await this.auditService.log('http.request', auditPayload, userId);
      } catch (error) {
        // Never throw from audit - just log locally
        this.logger.error('Failed to log audit event', error);
      }
    });

    // Handle errors (async)
    res.on('error', async (error) => {
      try {
        const duration = Date.now() - startTime;
        const userId = req.user && (req.user as any).sub ? (req.user as any).sub : undefined;

        await this.auditService.log('http.error', {
          method,
          path,
          error: error.message,
          duration_ms: duration,
        }, userId);
      } catch (auditError) {
        this.logger.error('Failed to log error audit event', auditError);
      }
    });

    next();
  }

  private shouldCaptureBody(path: string): boolean {
    return this.captureBodyPaths.some(cp => path.startsWith(cp));
  }
}
