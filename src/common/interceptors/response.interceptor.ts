import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { ApiResponse } from '@/common/types';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    private readonly logger = new Logger(ResponseInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
        const start = Date.now();
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();

        return next.handle().pipe(
            map((data) => {
                const duration = Date.now() - start;

                // Log successful requests
                this.logger.log(
                    `${request.method} ${request.url} - ${response.statusCode} - ${duration}ms`
                );

                // Handle different response types
                if (this.isApiResponse(data)) {
                    // Data is already in ApiResponse format
                    return {
                        ...data,
                        metadata: {
                            ...data.metadata,
                            timestamp: data.metadata?.timestamp || new Date(),
                            requestId: this.generateRequestId(),
                            version: 'v1',
                            duration: `${duration}ms`,
                        },
                    };
                }

                // Handle paginated responses
                if (this.isPaginatedData(data)) {
                    return {
                        success: true,
                        data: data.items,
                        pagination: data.pagination,
                        metadata: {
                            timestamp: new Date(),
                            requestId: this.generateRequestId(),
                            version: 'v1',
                            duration: `${duration}ms`,
                        },
                    };
                }

                // Handle regular data responses
                return {
                    success: true,
                    data,
                    metadata: {
                        timestamp: new Date(),
                        requestId: this.generateRequestId(),
                        version: 'v1',
                        duration: `${duration}ms`,
                    },
                };
            }),
        );
    }

    private isApiResponse(data: any): data is ApiResponse {
        return data && typeof data === 'object' && 'success' in data;
    }

    private isPaginatedData(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            'items' in data &&
            'pagination' in data &&
            Array.isArray(data.items)
        );
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}