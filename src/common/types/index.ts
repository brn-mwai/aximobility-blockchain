import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';

// ================================
// BLOCKCHAIN CORE TYPES
// ================================

export enum PeaqNetwork {
  MAIN = 'main',
  KREST = 'krest',
  AGUNG = 'agung',
}

export interface PeaqNetworkConfig {
  [PeaqNetwork.MAIN]: string;
  [PeaqNetwork.KREST]: string;
  [PeaqNetwork.AGUNG]: string;
}

export interface BlockchainConfig {
  peaq: {
    networks: PeaqNetworkConfig;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  contracts: {
    gasLimit: string;
    gasPrice: string;
  };
}

// ================================
// DID TYPES
// ================================

export interface VehicleIdentity {
  id: string;
  didIdentifier: string;
  vehicleId: string;
  attributes: VehicleAttributes;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleAttributes {
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  color: string;
  engineType: 'electric' | 'hybrid' | 'gasoline' | 'diesel';
  batteryCapacity?: number; // kWh for electric vehicles
}

export interface SensorIdentity {
  id: string;
  didIdentifier: string;
  sensorType: SensorType;
  vehicleId: string;
  specifications: SensorSpecifications;
  calibrationData?: Record<string, any>;
}

export enum SensorType {
  GPS = 'gps',
  ACCELEROMETER = 'accelerometer',
  GYROSCOPE = 'gyroscope',
  BATTERY = 'battery',
  TEMPERATURE = 'temperature',
  SPEED = 'speed',
  FUEL_LEVEL = 'fuel_level',
  ENGINE_RPM = 'engine_rpm',
}

export interface SensorSpecifications {
  manufacturer: string;
  model: string;
  accuracy: string;
  range: string;
  units: string;
}

// ================================
// TELEMETRY TYPES
// ================================

export interface TelemetryData {
  id: string;
  vehicleId: string;
  sensorId: string;
  timestamp: Date;
  data: TelemetryReading;
  location?: GeoLocation;
  blockchainTxHash?: string;
}

export interface TelemetryReading {
  sensorType: SensorType;
  value: number | string | boolean;
  unit: string;
  quality: DataQuality;
  rawData?: Record<string, any>;
}

export enum DataQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INVALID = 'invalid',
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

// ================================
// SMART CONTRACT TYPES
// ================================

export interface FareCalculationInput {
  vehicleId: string;
  startLocation: GeoLocation;
  endLocation: GeoLocation;
  distance: number; // in kilometers
  duration: number; // in minutes
  timestamp: Date;
  riderId: string;
}

export interface FareCalculationResult {
  baseFare: string; // in wei or smallest unit
  distanceFare: string;
  timeFare: string;
  totalFare: string;
  currency: string;
  exchangeRate?: string;
}

export interface TokenTransaction {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  tokenType: TokenType;
  purpose: TransactionPurpose;
  blockNumber: number;
  timestamp: Date;
  gasUsed: string;
  gasPrice: string;
}

export enum TokenType {
  AXI_TOKEN = 'AXI',
  ECO_COIN = 'ECO',
  PEAQ_TOKEN = 'PEAQ',
}

export enum TransactionPurpose {
  FARE_PAYMENT = 'fare_payment',
  ECO_REWARD = 'eco_reward',
  STAKING = 'staking',
  GOVERNANCE = 'governance',
  INFRASTRUCTURE_PAYMENT = 'infrastructure_payment',
}

// ================================
// API RESPONSE TYPES
// ================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ================================
// BLOCKCHAIN SERVICE TYPES
// ================================

export interface PeaqService {
  api: ApiPromise;
  keyring: KeyringPair;
  isConnected: boolean;
  network: PeaqNetwork;
}

export interface TransactionOptions {
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
  retryAttempts?: number;
}

export interface BlockchainTransaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: TransactionStatus;
  timestamp: Date;
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REVERTED = 'reverted',
}

// ================================
// CONFIGURATION TYPES
// ================================

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number;
}

export interface AppConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  apiVersion: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
}

// ================================
// ERROR TYPES
// ================================

export class BlockchainConnectionError extends Error {
  constructor(
    message: string,
    public network: PeaqNetwork,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BlockchainConnectionError';
  }
}

export class DIDRegistrationError extends Error {
  constructor(
    message: string,
    public didIdentifier: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DIDRegistrationError';
  }
}

export class TelemetryProcessingError extends Error {
  constructor(
    message: string,
    public vehicleId: string,
    public sensorId: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TelemetryProcessingError';
  }
}

export class SmartContractError extends Error {
  constructor(
    message: string,
    public contractAddress: string,
    public method: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SmartContractError';
  }
}

// ================================
// UTILITY TYPES
// ================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<ApiResponse<T>>;

// Brand types for better type safety
export type DIDIdentifier = string & { __brand: 'DIDIdentifier' };
export type VehicleId = string & { __brand: 'VehicleId' };
export type SensorId = string & { __brand: 'SensorId' };
export type TransactionHash = string & { __brand: 'TransactionHash' };
export type BlockchainAddress = string & { __brand: 'BlockchainAddress' };

// Helper type constructors
export const createDIDIdentifier = (id: string): DIDIdentifier => id as DIDIdentifier;
export const createVehicleId = (id: string): VehicleId => id as VehicleId;
export const createSensorId = (id: string): SensorId => id as SensorId;
export const createTransactionHash = (hash: string): TransactionHash => hash as TransactionHash;
export const createBlockchainAddress = (address: string): BlockchainAddress =>
  address as BlockchainAddress;
