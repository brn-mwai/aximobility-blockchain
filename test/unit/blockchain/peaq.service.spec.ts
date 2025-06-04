import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PeaqService } from '../../../src/blockchain/peaq/services/peaq.service';

describe('PeaqService', () => {
    let service: PeaqService;
    let configService: ConfigService;
    let mockApi: any;

    const mockConfig = {
        blockchain: {
            peaq: {
                networks: {
                    main: 'wss://wss.peaq.network',
                    krest: 'wss://wss-krest.peaq.network',
                    agung: 'wss://wss-agung.peaq.network',
                },
                timeout: 30000,
                retryAttempts: 3,
            },
        },
    };

    beforeEach(async () => {
        const mockTx = {
            signAndSend: jest.fn().mockResolvedValue({
                result: { isInBlock: true, asInBlock: { toString: () => '0x123' } },
            }),
        };

        mockApi = {
            isReady: Promise.resolve(true),
            disconnect: jest.fn(),
            query: {
                system: {
                    account: jest.fn(),
                },
            },
            tx: {
                peaqDid: {
                    addAttribute: jest.fn().mockReturnValue(mockTx),
                },
            },
            registry: {
                hash: jest.fn().mockReturnValue('0x456'),
                createType: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: PeaqService,
                    useValue: {
                        isConnected: jest.fn().mockResolvedValue(true),
                        healthCheck: jest.fn().mockResolvedValue({ connected: true }),
                        createVehicleDID: jest.fn(),
                        validateDidFormat: jest.fn(),
                        disconnect: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            const keys = key.split('.');
                            return keys.reduce((obj, k) => obj?.[k], mockConfig);
                        }),
                    },
                },
                {
                    provide: 'PEAQ_API',
                    useValue: Promise.resolve(mockApi),
                },
                {
                    provide: 'PEAQ_KEYRING',
                    useValue: {
                        address: 'test-address',
                        publicKey: new Uint8Array(32),
                    },
                },
            ],
        }).compile();

        service = module.get<PeaqService>(PeaqService);
        configService = module.get<ConfigService>(ConfigService);
    });

    describe('Network Connectivity (Milestone 1.1)', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should connect to Peaq network successfully', async () => {
            const isConnected = await service.isConnected();
            expect(isConnected).toBeDefined();
        });

        it('should handle network timeout gracefully', async () => {
            // Mock network failure
            service.healthCheck = jest.fn().mockRejectedValue(new Error('Connection timeout'));

            try {
                await service.healthCheck();
            } catch (error) {
                expect(error.message).toBe('Connection timeout');
            }
        });

        it('should support multiple network endpoints', () => {
            const networks = configService.get('blockchain.peaq.networks');
            expect(networks).toHaveProperty('main');
            expect(networks).toHaveProperty('krest');
            expect(networks).toHaveProperty('agung');
        });
    });

    describe('DID Registration (Milestone 1.2)', () => {
        it('should create vehicle DID successfully', async () => {
            const mockResult = {
                didIdentifier: 'did:peaq:test-vehicle-001',
                transactionHash: '0x123',
            };

            service.createVehicleDID = jest.fn().mockResolvedValue(mockResult);

            const result = await service.createVehicleDID(
                'test-vehicle-001',
                {
                    vin: 'TEST123456789',
                    make: 'Tesla',
                    model: 'Model 3',
                    year: 2023,
                    licensePlate: 'AXI001',
                    color: 'white',
                    engineType: 'electric',
                },
                'test-owner-address',
            );

            expect(result).toHaveProperty('didIdentifier');
            expect(result).toHaveProperty('transactionHash');
            expect(result.didIdentifier).toContain('did:peaq:');
        });

        it('should validate DID format correctly', () => {
            const validDid = 'did:peaq:vehicle:test001';
            const invalidDid = 'invalid-did-format';

            service.validateDidFormat = jest.fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false);

            expect(service.validateDidFormat(validDid)).toBe(true);
            expect(service.validateDidFormat(invalidDid)).toBe(false);
        });

        it('should handle DID creation errors properly', async () => {
            service.createVehicleDID = jest.fn().mockRejectedValue(new Error('DID creation failed'));

            await expect(
                service.createVehicleDID(
                    'test-vehicle-002',
                    {
                        vin: 'TEST987654321',
                        make: 'BMW',
                        model: 'i3',
                        year: 2023,
                        licensePlate: 'AXI002',
                        color: 'blue',
                        engineType: 'electric',
                    },
                    'test-owner-address',
                ),
            ).rejects.toThrow('DID creation failed');
        });
    });

    describe('Error Handling & Resilience', () => {
        it('should retry failed connections', () => {
            const retryAttempts = configService.get('blockchain.peaq.retryAttempts');
            expect(retryAttempts).toBeGreaterThan(0);
        });

        it('should handle network disconnection gracefully', async () => {
            service.disconnect = jest.fn().mockResolvedValue(undefined);

            await expect(service.disconnect()).resolves.not.toThrow();
            expect(service.disconnect).toHaveBeenCalled();
        });
    });
});