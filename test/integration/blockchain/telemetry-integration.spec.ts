import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TelemetryService } from '../../../src/telemetry/telemetry.service';
import { PeaqService } from '../../../src/blockchain/peaq/services/peaq.service';
import { SensorType, DataQuality, VehicleAttributes } from '../../../src/common/types';

// Define the expected return type for telemetry processing
interface TelemetryProcessResult {
    recordId: string;
    processed: boolean;
    qualityScore?: number;
}

describe('Telemetry Integration Tests', () => {
    let app: INestApplication;
    let telemetryService: TelemetryService;
    let peaqService: PeaqService;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                TelemetryService,
                PeaqService,
                // Add mock providers
                {
                    provide: 'TELEMETRY_PROCESSOR_CONTRACT',
                    useValue: {
                        processRecord: jest.fn().mockResolvedValue({ recordId: 'test-record', processed: true }),
                        processBatch: jest.fn().mockResolvedValue({ batchId: 'test-batch', processedCount: 3 }),
                    },
                },
                {
                    provide: 'PEAQ_API',
                    useValue: {
                        tx: { peaqDid: { addAttribute: jest.fn() } },
                        registry: { hash: jest.fn() },
                    },
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        telemetryService = app.get<TelemetryService>(TelemetryService);
        peaqService = app.get<PeaqService>(PeaqService);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Data Pipeline Integration', () => {
        it('should process real-time telemetry stream', async () => {
            const telemetryStream = [
                { sensorType: 'GPS', value: 40.7128, timestamp: Date.now() },
                { sensorType: 'SPEED', value: 65, timestamp: Date.now() + 1000 },
                { sensorType: 'BATTERY', value: 85, timestamp: Date.now() + 2000 },
            ];

            const results: TelemetryProcessResult[] = [];
            for (const data of telemetryStream) {
                const result = await telemetryService.processTelemetryData({
                    id: `stream-${data.timestamp}`,
                    vehicleId: 'integration-test-vehicle-001',
                    sensorId: `${data.sensorType}_SENSOR_001`,
                    timestamp: new Date(data.timestamp),
                    data: {
                        sensorType: data.sensorType as SensorType,
                        value: data.value,
                        unit: 'mixed',
                        quality: DataQuality.HIGH,
                    },
                });
                results.push(result);
            }

            expect(results.every(r => r.processed)).toBe(true);
        });

        it('should maintain data consistency across services', async () => {
            const vehicleId = 'consistency-test-vehicle';

            // Create vehicle in Peaq with all required attributes
            const vehicleAttributes: VehicleAttributes = {
                vin: 'CST123456789',
                make: 'Consistency',
                model: 'Test',
                year: 2023,
                licensePlate: 'CST001',
                color: 'White', // Required property
                engineType: 'electric',
                batteryCapacity: 75,
            };

            await peaqService.createVehicleDID(
                vehicleId,
                vehicleAttributes,
                'test-owner-address',
            );

            // Process telemetry for the vehicle
            const telemetryResult = await telemetryService.processTelemetryData({
                id: 'consistency-test-001',
                vehicleId,
                sensorId: 'GPS_001',
                timestamp: new Date(),
                data: {
                    sensorType: SensorType.GPS,
                    value: 40.7128,
                    unit: 'degrees',
                    quality: DataQuality.HIGH,
                },
            });

            // Verify data consistency
            const vehicleData = await peaqService.getVehicleData(`did:peaq:${vehicleId}`);
            expect(vehicleData).toBeDefined();
            expect(telemetryResult.processed).toBe(true);
        });
    });
});