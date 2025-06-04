import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VehicleAttributes, SensorType, DIDIdentifier, TransactionHash } from '../../../common/types';

@Injectable()
export class PeaqService {
  private readonly logger = new Logger(PeaqService.name);
  private connected = true;
  private highCongestionMode = false;

  constructor(private configService: ConfigService) { }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async healthCheck(): Promise<{
    peaqConnection: boolean;
    ethereumConnection: boolean;
    inkContracts: boolean;
    solidityContracts: boolean;
  }> {
    return {
      peaqConnection: this.connected,
      ethereumConnection: true,
      inkContracts: true,
      solidityContracts: true,
    };
  }

  async createVehicleDID(
    vehicleId: string,
    attributes: VehicleAttributes,
    ownerAddress: string,
  ): Promise<{
    didIdentifier: DIDIdentifier;
    transactionHash: TransactionHash;
    gasUsed?: string;
  }> {
    this.logger.log(`Creating vehicle DID for: ${vehicleId}`);

    if (!this.connected) {
      throw new Error('Not connected to Peaq network');
    }

    const didIdentifier = `did:peaq:vehicle:${vehicleId}` as DIDIdentifier;
    const transactionHash = `0x${Math.random().toString(16).substring(2)}` as TransactionHash;

    const result = {
      didIdentifier,
      transactionHash,
    };

    if (this.highCongestionMode) {
      return {
        ...result,
        gasUsed: '150000', // Higher gas usage during congestion
      };
    }

    return result;
  }

  async createSensorDID(
    sensorId: string,
    sensorType: string,
    vehicleId: string,
    specifications: any,
  ): Promise<{
    didIdentifier: DIDIdentifier;
    transactionHash: TransactionHash;
  }> {
    this.logger.log(`Creating sensor DID for: ${sensorId}`);

    if (!this.connected) {
      throw new Error('Not connected to Peaq network');
    }

    const didIdentifier = `did:peaq:sensor:${sensorId}` as DIDIdentifier;
    const transactionHash = `0x${Math.random().toString(16).substring(2)}` as TransactionHash;

    return {
      didIdentifier,
      transactionHash,
    };
  }

  validateDidFormat(did: string): boolean {
    return did.startsWith('did:peaq:') && did.length > 9;
  }

  async disconnect(): Promise<void> {
    this.logger.log('Disconnecting from Peaq network');
    this.connected = false;
  }

  async reconnect(): Promise<void> {
    this.logger.log('Reconnecting to Peaq network');
    this.connected = true;
  }

  async testNetworkConnection(network: string): Promise<boolean> {
    this.logger.log(`Testing connection to network: ${network}`);
    return this.connected;
  }

  async waitForFinality(txHash: string, timeout: number): Promise<boolean> {
    this.logger.log(`Waiting for finality of transaction: ${txHash}`);
    // Simulate finality check
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000);
    });
  }

  async getVehicleData(didIdentifier: string): Promise<any> {
    this.logger.log(`Getting vehicle data for DID: ${didIdentifier}`);
    return {
      didIdentifier,
      owner: 'test-owner',
      createdAt: new Date(),
      status: 'active',
    };
  }

  async getSensorData(didIdentifier: string): Promise<any> {
    this.logger.log(`Getting sensor data for DID: ${didIdentifier}`);
    return {
      didIdentifier,
      sensorType: 'GPS',
      parentVehicleDid: 'did:peaq:vehicle:test',
      createdAt: new Date(),
    };
  }

  // Test utility methods
  setHighCongestionMode(enabled: boolean): void {
    this.highCongestionMode = enabled;
  }
}