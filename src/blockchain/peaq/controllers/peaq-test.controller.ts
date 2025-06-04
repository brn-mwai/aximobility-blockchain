import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PeaqSdkService } from '../services/peaq.service';
import { PeaqNetwork, VehicleAttributes, SensorType } from '@/common/types';

@ApiTags('peaq-test')
@Controller({ path: 'peaq-test', version: '1' })
export class PeaqTestController {
    private readonly logger = new Logger(PeaqTestController.name);

    constructor(private readonly peaqSdkService: PeaqSdkService) { }

    @Get('network-info')
    @ApiOperation({ summary: 'Get network information for all Peaq networks' })
    @ApiResponse({
        status: 200,
        description: 'Network information retrieved successfully',
    })
    async getNetworkInfo() {
        this.logger.log('Getting network information for all Peaq networks');

        try {
            const networks = Object.values(PeaqNetwork);
            const networkInfoPromises = networks.map(async (network) => {
                try {
                    const info = await this.peaqSdkService.getNetworkInfo(network);
                    const health = await this.peaqSdkService.checkNetworkHealth(network);
                    return { ...info, isHealthy: health };
                } catch (error) {
                    return {
                        network,
                        error: error.message,
                        isHealthy: false,
                    };
                }
            });

            const networkInfos = await Promise.all(networkInfoPromises);

            return {
                success: true,
                data: networkInfos,
                metadata: {
                    timestamp: new Date(),
                    totalNetworks: networks.length,
                },
            };
        } catch (error) {
            this.logger.error('Failed to get network information:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_INFO_ERROR',
                    message: error.message,
                },
            };
        }
    }

    @Get('network-info/:network')
    @ApiOperation({ summary: 'Get information for a specific Peaq network' })
    @ApiParam({
        name: 'network',
        enum: PeaqNetwork,
        description: 'Peaq network name',
    })
    @ApiResponse({
        status: 200,
        description: 'Network information retrieved successfully',
    })
    async getSpecificNetworkInfo(@Param('network') network: PeaqNetwork) {
        this.logger.log(`Getting network information for ${network}`);

        try {
            const info = await this.peaqSdkService.getNetworkInfo(network);
            const health = await this.peaqSdkService.checkNetworkHealth(network);

            return {
                success: true,
                data: { ...info, isHealthy: health },
                metadata: {
                    timestamp: new Date(),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to get ${network} network information:`, error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_INFO_ERROR',
                    message: error.message,
                    details: { network },
                },
            };
        }
    }

    @Post('vehicle-did')
    @ApiOperation({ summary: 'Create a DID for a vehicle (Test)' })
    @ApiResponse({ status: 201, description: 'Vehicle DID created successfully' })
    async createTestVehicleDID(
        @Body()
        vehicleData: {
            vehicleId: string;
            owner: string;
            attributes: VehicleAttributes;
        },
        @Query('network') network: PeaqNetwork = PeaqNetwork.KREST
    ) {
        this.logger.log(`Creating test vehicle DID for vehicle: ${vehicleData.vehicleId}`);

        try {
            const result = await this.peaqSdkService.createVehicleDID(vehicleData, network);

            return {
                success: true,
                data: {
                    didIdentifier: result.didIdentifier,
                    txHash: result.txHash,
                    vehicleId: vehicleData.vehicleId,
                    network,
                },
                metadata: {
                    timestamp: new Date(),
                    action: 'create_vehicle_did',
                },
            };
        } catch (error) {
            this.logger.error('Failed to create vehicle DID:', error);
            return {
                success: false,
                error: {
                    code: 'DID_CREATION_ERROR',
                    message: error.message,
                    details: { vehicleId: vehicleData.vehicleId, network },
                },
            };
        }
    }

    @Post('sensor-did')
    @ApiOperation({ summary: 'Create a DID for a sensor (Test)' })
    @ApiResponse({ status: 201, description: 'Sensor DID created successfully' })
    async createTestSensorDID(
        @Body()
        sensorData: {
            sensorType: SensorType;
            vehicleId: string;
            specifications: {
                manufacturer: string;
                model: string;
                accuracy: string;
                range: string;
                units: string;
            };
        },
        @Query('network') network: PeaqNetwork = PeaqNetwork.KREST
    ) {
        this.logger.log(`Creating test sensor DID for sensor: ${sensorData.sensorType}`);

        try {
            const result = await this.peaqSdkService.createSensorDID(sensorData, network);

            return {
                success: true,
                data: {
                    didIdentifier: result.didIdentifier,
                    txHash: result.txHash,
                    sensorType: sensorData.sensorType,
                    vehicleId: sensorData.vehicleId,
                    network,
                },
                metadata: {
                    timestamp: new Date(),
                    action: 'create_sensor_did',
                },
            };
        } catch (error) {
            this.logger.error('Failed to create sensor DID:', error);
            return {
                success: false,
                error: {
                    code: 'DID_CREATION_ERROR',
                    message: error.message,
                    details: { sensorType: sensorData.sensorType, network },
                },
            };
        }
    }

    @Get('did/:didIdentifier')
    @ApiOperation({ summary: 'Get DID attributes (Test)' })
    @ApiParam({
        name: 'didIdentifier',
        description: 'DID identifier to retrieve',
    })
    @ApiQuery({ name: 'network', enum: PeaqNetwork, required: false })
    @ApiResponse({
        status: 200,
        description: 'DID attributes retrieved successfully',
    })
    async getDIDAttributes(
        @Param('didIdentifier') didIdentifier: string,
        @Query('network') network: PeaqNetwork = PeaqNetwork.KREST
    ) {
        this.logger.log(`Getting DID attributes for: ${didIdentifier}`);

        try {
            const attributes = await this.peaqSdkService.getDIDAttributes(
                didIdentifier as any, // Type casting for simplicity in test
                network
            );

            return {
                success: true,
                data: {
                    didIdentifier,
                    attributes,
                    network,
                },
                metadata: {
                    timestamp: new Date(),
                    action: 'get_did_attributes',
                },
            };
        } catch (error) {
            this.logger.error(`Failed to get DID attributes for ${didIdentifier}:`, error);
            return {
                success: false,
                error: {
                    code: 'DID_RETRIEVAL_ERROR',
                    message: error.message,
                    details: { didIdentifier, network },
                },
            };
        }
    }

    @Post('telemetry-store')
    @ApiOperation({ summary: 'Store telemetry data using Peaq Store (Test)' })
    @ApiResponse({
        status: 201,
        description: 'Telemetry data stored successfully',
    })
    async storeTelemetryData(
        @Body()
        telemetryData: {
            vehicleId: string;
            sensorId: string;
            data: Record<string, any>;
        },
        @Query('network') network: PeaqNetwork = PeaqNetwork.KREST
    ) {
        this.logger.log(`Storing telemetry data for vehicle: ${telemetryData.vehicleId}`);

        try {
            const result = await this.peaqSdkService.storeTelemetryData(
                {
                    vehicleId: telemetryData.vehicleId as any,
                    sensorId: telemetryData.sensorId as any,
                    telemetryData: telemetryData.data,
                },
                network
            );

            return {
                success: true,
                data: {
                    itemId: result.itemId,
                    txHash: result.txHash,
                    vehicleId: telemetryData.vehicleId,
                    network,
                },
                metadata: {
                    timestamp: new Date(),
                    action: 'store_telemetry_data',
                },
            };
        } catch (error) {
            this.logger.error('Failed to store telemetry data:', error);
            return {
                success: false,
                error: {
                    code: 'TELEMETRY_STORE_ERROR',
                    message: error.message,
                    details: { vehicleId: telemetryData.vehicleId, network },
                },
            };
        }
    }

    @Get('telemetry-store/:itemId')
    @ApiOperation({ summary: 'Retrieve telemetry data from Peaq Store (Test)' })
    @ApiParam({
        name: 'itemId',
        description: 'Item ID to retrieve from Peaq Store',
    })
    @ApiQuery({ name: 'network', enum: PeaqNetwork, required: false })
    @ApiResponse({
        status: 200,
        description: 'Telemetry data retrieved successfully',
    })
    async getTelemetryData(
        @Param('itemId') itemId: string,
        @Query('network') network: PeaqNetwork = PeaqNetwork.KREST
    ) {
        this.logger.log(`Getting telemetry data for item: ${itemId}`);

        try {
            const data = await this.peaqSdkService.getTelemetryData(itemId, network);

            return {
                success: true,
                data: {
                    itemId,
                    telemetryData: data,
                    network,
                },
                metadata: {
                    timestamp: new Date(),
                    action: 'get_telemetry_data',
                },
            };
        } catch (error) {
            this.logger.error(`Failed to get telemetry data for ${itemId}:`, error);
            return {
                success: false,
                error: {
                    code: 'TELEMETRY_RETRIEVAL_ERROR',
                    message: error.message,
                    details: { itemId, network },
                },
            };
        }
    }
}
