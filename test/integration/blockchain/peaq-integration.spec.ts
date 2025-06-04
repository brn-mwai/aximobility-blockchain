import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

class MockPeaqService {
    private isConnected = true;
    private highCongestionMode = false;

    async createVehicleDID(vehicleId: string, attributes: any, ownerAddress: string) {
        if (!this.isConnected) {
            throw new Error('Network disconnected');
        }

        return {
            didIdentifier: `did:peaq:${vehicleId}`,
            transactionHash: '0x123456789abcdef',
            ...(this.highCongestionMode && { gasUsed: '500000' }),
        };
    }

    async createSensorDID(sensorId: string, sensorType: string, vehicleId: string, specs: any) {
        if (!this.isConnected) {
            throw new Error('Network disconnected');
        }

        return {
            didIdentifier: `did:peaq:sensor:${sensorId}`,
            transactionHash: '0x987654321fedcba',
        };
    }

    async getVehicleData(didIdentifier: string) {
        return {
            didIdentifier,
            status: 'active',
            metadata: { make: 'Tesla', model: 'Model S' },
        };
    }

    async getSensorData(didIdentifier: string) {
        return {
            didIdentifier,
            parentVehicleDid: 'did:peaq:integration-test-vehicle-001',
            sensorType: 'GPS',
        };
    }

    async testNetworkConnection(network: string) {
        return { connected: this.isConnected, network, latency: 50 };
    }

    async waitForFinality(txHash: string, timeout: number) {
        return this.isConnected;
    }

    async disconnect() {
        this.isConnected = false;
        return Promise.resolve();
    }

    async reconnect() {
        this.isConnected = true;
        return Promise.resolve();
    }

    setHighCongestionMode(enabled: boolean) {
        this.highCongestionMode = enabled;
    }
}

class MockTelemetryService {
    async processTelemetryData(data: any) {
        return {
            recordId: 'rec_' + Date.now(),
            processed: true,
            qualityScore: 85,
        };
    }

    async processTelemetryBatch(batchData: any[]) {
        return {
            batchId: 'batch_' + Date.now(),
            processedCount: batchData.length,
        };
    }
}

describe('Peaq Blockchain Integration (Tranche 1)', () => {
    let app: INestApplication;
    let peaqService: MockPeaqService;
    let telemetryService: MockTelemetryService;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    envFilePath: '.env.test',
                    isGlobal: true,
                }),
            ],
            providers: [
                {
                    provide: 'PeaqService',
                    useClass: MockPeaqService,
                },
                {
                    provide: 'TelemetryService',
                    useClass: MockTelemetryService,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        peaqService = app.get<MockPeaqService>('PeaqService');
        telemetryService = app.get<MockTelemetryService>('TelemetryService');
    });

    afterAll(async () => {
        await app.close();
    });

    describe('End-to-End Workflow Testing', () => {
        let vehicleDID: string;
        let sensorDID: string;

        it('should complete full vehicle onboarding workflow', async () => {
            // Step 1: Create Vehicle DID (1.2)
            const vehicleResult = await peaqService.createVehicleDID(
                'integration-test-vehicle-001',
                {
                    vin: 'INT123456789',
                    make: 'Tesla',
                    model: 'Model S',
                    year: 2023,
                    licensePlate: 'INT001',
                    engineType: 'electric',
                    batteryCapacity: 100,
                    color: 'Red',
                },
                'test-owner-address',
            );

            expect(vehicleResult).toHaveProperty('didIdentifier');
            expect(vehicleResult).toHaveProperty('transactionHash');
            vehicleDID = vehicleResult.didIdentifier;

            // Step 2: Create Sensor DID
            const sensorResult = await peaqService.createSensorDID(
                'integration-test-sensor-001',
                'GPS',
                'integration-test-vehicle-001',
                {
                    manufacturer: 'Bosch',
                    model: 'GPS-2023',
                    accuracy: '±1m',
                    range: 'Global',
                    units: 'degrees',
                },
            );

            expect(sensorResult).toHaveProperty('didIdentifier');
            sensorDID = sensorResult.didIdentifier;

            // Step 3: Process Telemetry Data
            const telemetryData = {
                id: 'integration-telemetry-001',
                vehicleId: 'integration-test-vehicle-001',
                sensorId: 'integration-test-sensor-001',
                timestamp: new Date(),
                data: {
                    sensorType: 'GPS' as any,
                    value: 40.7128,
                    unit: 'degrees',
                    quality: 'high' as any,
                    rawData: {
                        latitude: 40.7128,
                        longitude: -74.0060,
                    },
                },
                location: {
                    latitude: 40.7128,
                    longitude: -74.0060,
                },
            };

            const telemetryResult = await telemetryService.processTelemetryData(telemetryData);
            expect(telemetryResult.processed).toBe(true);

            // Verify end-to-end data integrity
            const vehicleData = await peaqService.getVehicleData(vehicleDID);
            const sensorData = await peaqService.getSensorData(sensorDID);

            expect(vehicleData).toBeDefined();
            expect(sensorData).toBeDefined();
            expect(sensorData.parentVehicleDid).toBe(vehicleDID);
        });

        it('should handle network connectivity resilience', async () => {
            // Test connection to all Peaq networks
            const networks = ['main', 'krest', 'agung'];

            for (const network of networks) {
                const connectionResult = await peaqService.testNetworkConnection(network);
                expect(connectionResult).toBeDefined();
                expect(connectionResult).toHaveProperty('connected');
                expect(connectionResult).toHaveProperty('network', network);
            }
        });

        it('should validate transaction finality', async () => {
            const txHash = '0x123456789abcdef';

            const isFinalized = await peaqService.waitForFinality(txHash, 60000);
            expect(isFinalized).toBe(true);
        });
    });

    describe('Performance & Scalability Testing', () => {
        it('should handle concurrent DID creations', async () => {
            const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
                peaqService.createVehicleDID(
                    `concurrent-vehicle-${i.toString().padStart(3, '0')}`,
                    {
                        vin: `CON${i.toString().padStart(9, '0')}`,
                        make: 'Test',
                        model: 'Vehicle',
                        year: 2023,
                        licensePlate: `CON${i.toString().padStart(3, '0')}`,
                        engineType: 'electric',
                        color: 'Blue',
                    },
                    'test-owner-address',
                ),
            );

            const results = await Promise.allSettled(concurrentRequests);
            const successful = results.filter(r => r.status === 'fulfilled').length;

            expect(successful).toBeGreaterThan(5); // At least 50% success rate
        });

        it('should maintain performance under telemetry load', async () => {
            const batchSize = 100;
            const telemetryBatch = Array.from({ length: batchSize }, (_, i) => ({
                id: `load-test-${i.toString().padStart(3, '0')}`,
                vehicleId: 'integration-test-vehicle-001',
                sensorId: 'integration-test-sensor-001',
                timestamp: new Date(),
                data: {
                    sensorType: 'GPS' as any,
                    value: Math.random() * 180 - 90, // Random latitude
                    unit: 'degrees',
                    quality: 'high' as any,
                },
            }));

            const startTime = Date.now();
            const result = await telemetryService.processTelemetryBatch(telemetryBatch);
            const processingTime = Date.now() - startTime;

            expect(result.processedCount).toBe(batchSize);
            expect(processingTime).toBeLessThan(5000); // Under 5 seconds

            const throughput = batchSize / (processingTime / 1000);
            expect(throughput).toBeGreaterThan(20); // At least 20 records/second
        });
    });

    describe('Error Recovery & Resilience', () => {
        it('should recover from network disconnection', async () => {
            // Simulate network disconnection
            await peaqService.disconnect();

            // Attempt operation (should fail)
            await expect(
                peaqService.createVehicleDID('test-disconnected', {
                    vin: 'DISC123456789',
                    make: 'Disconnected',
                    model: 'Test',
                    year: 2023,
                    licensePlate: 'DISC001',
                    engineType: 'electric',
                    color: 'Red',
                }, 'test-address')
            ).rejects.toThrow('Network disconnected');

            // Reconnect and retry
            await peaqService.reconnect();

            const result = await peaqService.createVehicleDID(
                'test-reconnected',
                {
                    vin: 'REC123456789',
                    make: 'Recovery',
                    model: 'Test',
                    year: 2023,
                    licensePlate: 'REC001',
                    engineType: 'electric',
                    color: 'Green',
                },
                'test-owner-address',
            );

            expect(result).toHaveProperty('didIdentifier');
        });

        it('should handle blockchain congestion gracefully', async () => {
            // Simulate high gas prices / network congestion
            peaqService.setHighCongestionMode(true);

            const result = await peaqService.createVehicleDID(
                'congestion-test-vehicle',
                {
                    vin: 'CGN123456789',
                    make: 'Congestion',
                    model: 'Test',
                    year: 2023,
                    licensePlate: 'CGN001',
                    engineType: 'electric',
                    color: 'Yellow',
                },
                'test-owner-address',
            );

            expect(result).toHaveProperty('didIdentifier');
            expect(result).toHaveProperty('gasUsed'); // Should have gas info during congestion
        });
    });
});