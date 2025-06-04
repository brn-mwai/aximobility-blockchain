import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from '../../../src/telemetry/telemetry.service';
import { TelemetryData, SensorType, DataQuality } from '../../../src/common/types';

describe('TelemetryService', () => {
    let service: TelemetryService;

    const mockTelemetryData: TelemetryData = {
        id: 'tel-001',
        vehicleId: 'AXI_001',
        sensorId: 'GPS_001',
        timestamp: new Date(),
        data: {
            sensorType: SensorType.GPS,
            value: 40.7128,
            unit: 'degrees',
            quality: DataQuality.HIGH,
            rawData: {
                latitude: 40.7128,
                longitude: -74.0060,
                accuracy: 5,
            },
        },
        location: {
            latitude: 40.7128,
            longitude: -74.0060,
            altitude: 10,
            accuracy: 5,
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TelemetryService,
                {
                    provide: 'TELEMETRY_PROCESSOR_CONTRACT',
                    useValue: {
                        processRecord: jest.fn(),
                        processBatch: jest.fn(),
                        getStats: jest.fn(),
                        authorizeVehicle: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<TelemetryService>(TelemetryService);
    });

    describe('Data Pipeline (Milestone 1.2)', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should process single telemetry record', async () => {
            const result = await service.processTelemetryData(mockTelemetryData);

            expect(result).toHaveProperty('recordId');
            expect(result).toHaveProperty('processed');
            expect(result.processed).toBe(true);
        });

        it('should validate telemetry data format', () => {
            const isValid = service.validateTelemetryData(mockTelemetryData);
            expect(isValid).toBe(true);
        });

        it('should reject invalid telemetry data', () => {
            const invalidData = {
                ...mockTelemetryData,
                data: {
                    ...mockTelemetryData.data,
                    quality: DataQuality.INVALID,
                },
            };

            const isValid = service.validateTelemetryData(invalidData);
            expect(isValid).toBe(false);
        });

        it('should handle different sensor types', async () => {
            const sensorTypes = [
                SensorType.GPS,
                SensorType.ACCELEROMETER,
                SensorType.BATTERY,
                SensorType.SPEED,
            ];

            for (const sensorType of sensorTypes) {
                const data = {
                    ...mockTelemetryData,
                    data: {
                        ...mockTelemetryData.data,
                        sensorType,
                    },
                };

                const result = await service.processTelemetryData(data);
                expect(result.processed).toBe(true);
            }
        });
    });

    describe('Data Quality & Validation', () => {
        it('should calculate quality score correctly', () => {
            const score = service.calculateQualityScore(mockTelemetryData.data);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(100);
        });

        it('should detect anomalies in data', () => {
            const anomalousData = {
                ...mockTelemetryData,
                data: {
                    ...mockTelemetryData.data,
                    value: 999999, // Unrealistic GPS coordinate
                },
            };

            const hasAnomaly = service.detectAnomalies(anomalousData);
            expect(hasAnomaly).toBe(true);
        });

        it('should filter out low quality data', async () => {
            const lowQualityData = {
                ...mockTelemetryData,
                data: {
                    ...mockTelemetryData.data,
                    quality: DataQuality.LOW,
                },
            };

            const result = await service.processTelemetryData(lowQualityData);
            expect(result.processed).toBe(false);
        });
    });

    describe('Batch Processing', () => {
        it('should process telemetry batch efficiently', async () => {
            const batchData = Array.from({ length: 10 }, (_, i) => ({
                ...mockTelemetryData,
                id: `tel-${i.toString().padStart(3, '0')}`,
            }));

            const result = await service.processTelemetryBatch(batchData);

            expect(result).toHaveProperty('batchId');
            expect(result).toHaveProperty('processedCount');
            expect(result.processedCount).toBe(10);
        });

        it('should handle large batches within limits', async () => {
            const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
                ...mockTelemetryData,
                id: `tel-${i.toString().padStart(4, '0')}`,
            }));

            const result = await service.processTelemetryBatch(largeBatch);
            expect(result.processedCount).toBeLessThanOrEqual(1000);
        });

        it('should reject oversized batches', async () => {
            const oversizedBatch = Array.from({ length: 1001 }, (_, i) => ({
                ...mockTelemetryData,
                id: `tel-${i.toString().padStart(4, '0')}`,
            }));

            await expect(
                service.processTelemetryBatch(oversizedBatch),
            ).rejects.toThrow('Batch too large');
        });
    });

    describe('Performance & Optimization', () => {
        it('should meet processing time targets', async () => {
            const startTime = Date.now();

            await service.processTelemetryData(mockTelemetryData);

            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(100); // Should process in under 100ms
        });

        it('should maintain throughput under load', async () => {
            const startTime = Date.now();
            const promises = Array.from({ length: 100 }, (_, i) =>
                service.processTelemetryData({
                    ...mockTelemetryData,
                    id: `load-test-${i}`,
                }),
            );

            await Promise.all(promises);

            const totalTime = Date.now() - startTime;
            const throughput = 100 / (totalTime / 1000); // Records per second

            expect(throughput).toBeGreaterThan(10); // At least 10 records/second
        });
    });

    describe('Error Handling', () => {
        it('should handle missing vehicle authorization', async () => {
            const unauthorizedData = {
                ...mockTelemetryData,
                vehicleId: 'UNAUTHORIZED_VEHICLE',
            };

            await expect(
                service.processTelemetryData(unauthorizedData),
            ).rejects.toThrow('Vehicle not authorized');
        });

        it('should handle network failures gracefully', async () => {
            // Simulate network failure
            service.setNetworkStatus(false);

            await expect(
                service.processTelemetryData(mockTelemetryData),
            ).rejects.toThrow('Network unavailable');
        });

        it('should retry failed transmissions', async () => {
            const retryData = {
                ...mockTelemetryData,
                id: 'retry-test-001',
            };

            // First call fails, second succeeds
            service.setFailureMode(true);
            await expect(
                service.processTelemetryData(retryData),
            ).rejects.toThrow();

            service.setFailureMode(false);
            const result = await service.processTelemetryData(retryData);
            expect(result.processed).toBe(true);
        });
    });
});