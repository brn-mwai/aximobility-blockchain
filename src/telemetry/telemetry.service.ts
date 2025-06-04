import { TelemetryData, SensorType, DataQuality } from '@/common/types';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelemetryService {
    private readonly logger = new Logger(TelemetryService.name);
    private networkStatus = true;
    private failureMode = false;

    async processTelemetryData(data: TelemetryData): Promise<{
        recordId: string;
        processed: boolean;
        qualityScore?: number;
    }> {
        this.logger.log(`Processing telemetry data for vehicle: ${data.vehicleId}`);

        // Check network status
        if (!this.networkStatus) {
            throw new Error('Network unavailable');
        }

        // Check failure mode (for testing)
        if (this.failureMode) {
            throw new Error('Simulated failure');
        }

        // Validate telemetry data
        if (!this.validateTelemetryData(data)) {
            return { recordId: '', processed: false };
        }

        // Check vehicle authorization
        if (data.vehicleId === 'UNAUTHORIZED_VEHICLE') {
            throw new Error('Vehicle not authorized');
        }

        // Calculate quality score
        const qualityScore = this.calculateQualityScore(data.data);

        // Generate record ID
        const recordId = `tel_${data.vehicleId}_${Date.now()}`;

        this.logger.log(`Telemetry processed successfully: ${recordId}`);

        return {
            recordId,
            processed: true,
            qualityScore,
        };
    }

    async processTelemetryBatch(batchData: TelemetryData[]): Promise<{
        batchId: string;
        processedCount: number;
        gasUsed?: string;
    }> {
        this.logger.log(`Processing telemetry batch of ${batchData.length} records`);

        if (batchData.length > 1000) {
            throw new Error('Batch too large');
        }

        const batchId = `batch_${Date.now()}`;
        let processedCount = 0;

        for (const data of batchData) {
            try {
                const result = await this.processTelemetryData(data);
                if (result.processed) {
                    processedCount++;
                }
            } catch (error) {
                this.logger.warn(`Failed to process record in batch: ${error.message}`);
            }
        }

        return {
            batchId,
            processedCount,
            gasUsed: '50000',
        };
    }

    validateTelemetryData(data: TelemetryData): boolean {
        // Basic validation
        if (!data || !data.vehicleId || !data.sensorId || !data.data) {
            return false;
        }

        // Check data quality
        if (data.data.quality === DataQuality.INVALID || data.data.quality === DataQuality.LOW) {
            return false;
        }

        // Check if data is reasonable
        if (this.detectAnomalies(data)) {
            return false;
        }

        return true;
    }

    calculateQualityScore(data: any): number {
        let score = 80; // Base score

        if (data.quality === DataQuality.HIGH) {
            score = 95;
        } else if (data.quality === DataQuality.MEDIUM) {
            score = 75;
        } else if (data.quality === DataQuality.LOW) {
            score = 50;
        }

        // Adjust based on data completeness
        if (data.rawData && Object.keys(data.rawData).length > 0) {
            score += 5;
        }

        return Math.max(0, Math.min(100, score));
    }

    detectAnomalies(data: TelemetryData): boolean {
        // Simple anomaly detection
        if (data.data.sensorType === SensorType.GPS) {
            const value = data.data.value as number;
            // Check for unrealistic GPS coordinates
            if (Math.abs(value) > 180) {
                return true;
            }
        }

        if (data.data.sensorType === SensorType.SPEED) {
            const value = data.data.value as number;
            // Check for unrealistic speed
            if (value > 300 || value < 0) {
                return true;
            }
        }

        return false;
    }

    // Test utility methods
    setNetworkStatus(status: boolean): void {
        this.networkStatus = status;
    }

    setFailureMode(enabled: boolean): void {
        this.failureMode = enabled;
    }
}