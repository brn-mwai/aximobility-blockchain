import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
    BlockchainConnectionError,
    DIDRegistrationError,
    TelemetryProcessingError,
    SmartContractError
} from '@/common/types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: HttpStatus;
        let message: string;
        let error: string;
        let details: any = null;

        // Handle custom blockchain errors
        if (exception instanceof BlockchainConnectionError) {
            status = HttpStatus.SERVICE_UNAVAILABLE;
            message = `Blockchain connection failed for network: ${exception.network}`;
            error = 'BLOCKCHAIN_CONNECTION_ERROR';
            details = {
                network: exception.network,
                originalError: exception.originalError?.message,
            };
        } else if (exception instanceof DIDRegistrationError) {
            status = HttpStatus.BAD_REQUEST;
            message = `DID registration failed for identifier: ${exception.didIdentifier}`;
            error = 'DID_REGISTRATION_ERROR';
            details = {
                didIdentifier: exception.didIdentifier,
                originalError: exception.originalError?.message,
            };
        } else if (exception instanceof TelemetryProcessingError) {
            status = HttpStatus.UNPROCESSABLE_ENTITY;
            message = `Telemetry processing failed for vehicle: ${exception.vehicleId}`;
            error = 'TELEMETRY_PROCESSING_ERROR';
            details = {
                vehicleId: exception.vehicleId,
                sensorId: exception.sensorId,
                originalError: exception.originalError?.message,
            };
        } else if (exception instanceof SmartContractError) {
            status = HttpStatus.BAD_REQUEST;
            message = `Smart contract error in ${exception.method}`;
            error = 'SMART_CONTRACT_ERROR';
            details = {
                contractAddress: exception.contractAddress,
                method: exception.method,
                originalError: exception.originalError?.message,
            };
        } else if (exception instanceof HttpException) {
            // Handle NestJS HTTP exceptions
            status = exception.getStatus();
            const errorResponse = exception.getResponse();

            if (typeof errorResponse === 'object') {
                message = (errorResponse as any).message || exception.message;
                error = (errorResponse as any).error || 'HTTP_EXCEPTION';
                details = (errorResponse as any).details || null;
            } else {
                message = errorResponse as string;
                error = 'HTTP_EXCEPTION';
            }
        } else {
            // Handle unexpected errors
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Internal server error';
            error = 'INTERNAL_SERVER_ERROR';

            if (exception instanceof Error) {
                details = {
                    name: exception.name,
                    stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
                };
            }
        }

        // Log the error
        const errorLog = {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            status,
            error,
            message,
            details,
            userAgent: request.get('User-Agent'),
            ip: request.ip,
        };

        if (status >= 500) {
            this.logger.error('Internal server error', JSON.stringify(errorLog));
        } else {
            this.logger.warn('Client error', JSON.stringify(errorLog));
        }

        // Send error response
        const errorResponse = {
            success: false,
            error: {
                code: error,
                message,
                details: process.env.NODE_ENV === 'development' ? details : undefined,
            },
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: this.generateRequestId(),
                path: request.url,
                method: request.method,
            },
        };

        response.status(status).json(errorResponse);
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}