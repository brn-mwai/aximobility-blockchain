import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import request from 'supertest';

describe('Tranche 1 - Complete Workflow (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('Milestone 1.1: Network Connectivity', () => {
        it('/health/blockchain (GET)', async () => {
            const response = await request(app.getHttpServer())
                .get('/health/blockchain')
                .expect(200);

            expect(response.body).toMatchObject({
                peaqConnection: true,
                networks: {
                    main: expect.any(Object),
                    krest: expect.any(Object),
                    agung: expect.any(Object)
                }
            });
        });

        it('/blockchain/networks (GET)', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/blockchain/networks')
                .expect(200);

            expect(response.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: expect.any(String),
                        status: expect.any(String)
                    })
                ])
            );
        });
    });

    describe('Milestone 1.2: DID System & Data Pipeline', () => {
        const vehiclePayload = {
            vehicleId: 'e2e-test-vehicle-001',
            vin: 'E2E123456789',
            make: 'Tesla',
            model: 'Model Y',
            year: 2023,
            licensePlate: 'E2E001',
            engineType: 'electric',
            batteryCapacity: 75,
        };

        it('should create vehicle DID', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/blockchain/did/vehicle')
                .send(vehiclePayload)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    didIdentifier: expect.stringContaining('did:peaq:'),
                    transactionHash: expect.any(String)
                }
            });
        });

        it('should create sensor DID with vehicle linkage', async () => {
            const vehicleData = {
                ...vehiclePayload,
                vehicleId: 'e2e-test-vehicle-002',
                vin: 'E2E987654321',
                make: 'BMW',
                model: 'iX',
                licensePlate: 'E2E002',
                batteryCapacity: 105,
            };

            await request(app.getHttpServer())
                .post('/api/v1/blockchain/did/vehicle')
                .send(vehicleData)
                .expect(201);

            const sensorData = {
                sensorId: 'e2e-test-sensor-001',
                sensorType: 'GPS',
                vehicleId: 'e2e-test-vehicle-002',
                manufacturer: 'Bosch',
                model: 'GPS-2023',
                accuracy: '±1m',
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/blockchain/did/sensor')
                .send(sensorData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    didIdentifier: expect.stringContaining('did:peaq:sensor:')
                }
            });
        });

        it('should process telemetry data', async () => {
            const telemetryData = {
                vehicleId: 'e2e-test-vehicle-001',
                sensorId: 'e2e-test-sensor-001',
                data: {
                    sensorType: 'GPS',
                    value: 40.7128,
                    unit: 'degrees',
                    quality: 'high',
                    rawData: {
                        latitude: 40.7128,
                        longitude: -74.0060,
                        accuracy: 5,
                    },
                },
                location: {
                    latitude: 40.7128,
                    longitude: -74.0060,
                },
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/telemetry/process')
                .send(telemetryData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    recordId: expect.any(String),
                    processed: true,
                    qualityScore: expect.any(Number)
                }
            });
        });

        it('should handle batch telemetry processing', async () => {
            const batchData = {
                vehicleId: 'e2e-test-vehicle-001',
                telemetryRecords: Array.from({ length: 10 }, (_, i) => ({
                    sensorId: 'e2e-test-sensor-001',
                    timestamp: new Date(Date.now() + i * 1000).toISOString(),
                    data: {
                        sensorType: 'GPS',
                        value: 40.7128 + (i * 0.001),
                        unit: 'degrees',
                        quality: 'high',
                    },
                })),
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/telemetry/batch')
                .send(batchData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    batchId: expect.any(String),
                    processedCount: 10
                }
            });
        });
    });

    describe('Milestone 1.3: Smart Contract Infrastructure', () => {
        const rideData = {
            rider: '0x1234567890123456789012345678901234567890',
            driver: '0x0987654321098765432109876543210987654321',
            vehicleId: 'e2e-test-vehicle-001',
            estimatedDistance: 5000,
            estimatedDuration: 15,
        };

        it('should create ride and calculate fare', async () => {
            const createResponse = await request(app.getHttpServer())
                .post('/api/v1/rides/create')
                .send(rideData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.rideId).toBeDefined();

            const { rideId } = createResponse.body.data;

            const fareResponse = await request(app.getHttpServer())
                .post('/api/v1/rides/calculate-fare')
                .send({
                    rideId,
                    actualDistance: 5200,
                    actualDuration: 18,
                })
                .expect(200);

            expect(fareResponse.body).toMatchObject({
                success: true,
                data: {
                    fareBreakdown: {
                        baseFare: expect.any(Number),
                        distanceFare: expect.any(Number),
                        timeFare: expect.any(Number),
                        totalFare: expect.any(Number)
                    }
                }
            });
        });

        it('should estimate fare without ride creation', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/rides/estimate-fare')
                .send({
                    vehicleType: 'STANDARD',
                    distance: 5000,
                    duration: 15,
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    estimatedFare: expect.any(String)
                }
            });
            expect(parseFloat(response.body.data.estimatedFare)).toBeGreaterThan(0);
        });

        it('should return contract deployment status', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/contracts/status')
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    contracts: {
                        fareCalculator: expect.any(Object),
                        telemetryProcessor: expect.any(Object)
                    }
                }
            });
        });
    });

    describe('Complete End-to-End Workflow', () => {
        jest.setTimeout(60000);

        it('should complete full onboarding to ride completion workflow', async () => {
            const vehicleId = 'e2e-complete-workflow-001';
            const sensorId = 'workflow-gps-001';

            const vehicleResponse = await request(app.getHttpServer())
                .post('/api/v1/blockchain/did/vehicle')
                .send({
                    vehicleId,
                    vin: 'WFL123456789',
                    make: 'Rivian',
                    model: 'R1T',
                    year: 2023,
                    licensePlate: 'WFL001',
                    engineType: 'electric',
                    batteryCapacity: 135,
                })
                .expect(201);

            const { didIdentifier: vehicleDID } = vehicleResponse.body.data;

            await request(app.getHttpServer())
                .post('/api/v1/blockchain/did/sensor')
                .send({
                    sensorId,
                    sensorType: 'GPS',
                    vehicleId,
                    manufacturer: 'Garmin',
                    model: 'GPS-Pro-2023',
                    accuracy: '±0.5m',
                })
                .expect(201);

            const telemetryResponse = await request(app.getHttpServer())
                .post('/api/v1/telemetry/process')
                .send({
                    vehicleId,
                    sensorId,
                    data: {
                        sensorType: 'GPS',
                        value: 40.7589,
                        unit: 'degrees',
                        quality: 'high',
                        rawData: {
                            latitude: 40.7589,
                            longitude: -73.9851,
                            accuracy: 3,
                        },
                    },
                    location: {
                        latitude: 40.7589,
                        longitude: -73.9851,
                    },
                })
                .expect(201);

            const rideResponse = await request(app.getHttpServer())
                .post('/api/v1/rides/create')
                .send({
                    rider: '0x1111111111111111111111111111111111111111',
                    driver: '0x2222222222222222222222222222222222222222',
                    vehicleId,
                    estimatedDistance: 8000,
                    estimatedDuration: 20,
                })
                .expect(201);

            const { rideId } = rideResponse.body.data;

            await request(app.getHttpServer())
                .post('/api/v1/telemetry/batch')
                .send({
                    vehicleId,
                    telemetryRecords: Array.from({ length: 5 }, (_, i) => ({
                        sensorId,
                        timestamp: new Date(Date.now() + i * 60000).toISOString(),
                        data: {
                            sensorType: 'GPS',
                            value: 40.7589 + (i * 0.001),
                            unit: 'degrees',
                            quality: 'high',
                        },
                    })),
                })
                .expect(201);

            const fareResponse = await request(app.getHttpServer())
                .post('/api/v1/rides/calculate-fare')
                .send({
                    rideId,
                    actualDistance: 8500,
                    actualDuration: 22,
                })
                .expect(200);

            expect(vehicleDID).toContain('did:peaq:');
            expect(telemetryResponse.body.data.processed).toBe(true);
            expect(rideId).toBeDefined();
            expect(fareResponse.body.data.fareBreakdown.totalFare).toBeDefined();

            const statusResponse = await request(app.getHttpServer())
                .get(`/api/v1/vehicles/${vehicleId}/status`)
                .expect(200);

            expect(statusResponse.body.data).toMatchObject({
                didIdentifier: vehicleDID,
                lastTelemetryUpdate: expect.any(String),
                totalRides: expect.any(Number)
            });
        });
    });

    describe('System Health & Monitoring', () => {
        it('should provide system health status', async () => {
            const response = await request(app.getHttpServer())
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'ok',
                info: {
                    peaqConnection: expect.any(Object),
                    contractsDeployed: expect.any(Object),
                    telemetryPipeline: expect.any(Object)
                }
            });
        });

        it('should provide performance metrics', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/metrics')
                .expect(200);

            expect(response.body.data).toMatchObject({
                totalDIDs: expect.any(Number),
                totalTelemetryRecords: expect.any(Number),
                totalRides: expect.any(Number),
                avgProcessingTime: expect.any(Number)
            });
        });
    });
});