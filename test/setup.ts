import { configDotenv } from 'dotenv';

configDotenv({ path: '.env.test' });

interface MockVehicleData {
    vin: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    engineType: string;
    batteryCapacity: number;
}

interface MockTelemetryData {
    sensorType: string;
    value: number;
    unit: string;
    quality: string;
    rawData: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
}

interface TestUtils {
    generateRandomVehicleId: () => string;
    generateRandomSensorId: () => string;
    generateRandomDID: (type: string) => string;
    mockVehicleData: MockVehicleData;
    mockTelemetryData: MockTelemetryData;
    waitForAsyncOperation: (ms: number) => Promise<void>;
}

declare global {
    var testUtils: TestUtils;
    namespace NodeJS {
        interface Global {
            testUtils: TestUtils;
        }
    }
}

beforeAll(async () => {
    console.log('🧪 Starting Test Suite...');
    console.log('📋 Testing Scope:');
    console.log(' - 1.1: Network Connectivity');
    console.log(' - 1.2: DID System & Data Pipeline');
    console.log(' - 1.3: Smart Contract Infrastructure');
});

afterAll(async () => {
    console.log('✅ Test Suite Completed');
});

global.testUtils = {
    generateRandomVehicleId: (): string => `test-vehicle-${Date.now()}`,
    generateRandomSensorId: (): string => `test-sensor-${Date.now()}`,
    generateRandomDID: (type: string): string => `did:peaq:${type}:test-${Date.now()}`,
    mockVehicleData: {
        vin: 'TEST123456789',
        make: 'Tesla',
        model: 'Model 3',
        year: 2023,
        licensePlate: 'TEST001',
        engineType: 'electric',
        batteryCapacity: 75,
    },
    mockTelemetryData: {
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
    waitForAsyncOperation: (ms: number): Promise<void> =>
        new Promise(resolve => setTimeout(resolve, ms)),
};

// Export types for use in other test files
export type { TestUtils, MockVehicleData, MockTelemetryData };