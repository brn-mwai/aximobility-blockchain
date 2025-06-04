import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, query, params } = request;
        const start = Date.now();

        // Log incoming request
        this.logger.log(
            `Incoming Request: ${method} ${url}`,
            JSON.stringify({
                body: this.sanitizeData(body),
                query,
                params,
                userAgent: request.get('User-Agent'),
                ip: request.ip,
            }),
        );

        return next.handle().pipe(
            tap((data) => {
                const duration = Date.now() - start;
                this.logger.log(
                    `Request Completed: ${method} ${url} - ${duration}ms`,
                    JSON.stringify({
                        responseSize: JSON.stringify(data).length,
                        duration: `${duration}ms`,
                    }),
                );
            }),
            catchError((error) => {
                const duration = Date.now() - start;
                this.logger.error(
                    `Request Failed: ${method} ${url} - ${duration}ms`,
                    JSON.stringify({
                        error: error.message,
                        duration: `${duration}ms`,
                    }),
                );
                return throwError(() => error);
            }),
        );
    }

    private sanitizeData(data: any): any {
        if (!data) return data;

        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
        const sanitized = { ...data };

        for (const key of sensitiveKeys) {
            if (key in sanitized) {
                sanitized[key] = '***REDACTED***';
            }
        }

        return sanitized;
    }
}