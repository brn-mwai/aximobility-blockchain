import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { TelemetryReading, GeoLocation, DataQuality } from '@/common/types';
import { VehicleIdentityEntity } from './vehicle-identity.entity';
import { SensorIdentityEntity } from './sensor-identity.entity';

@Entity('telemetry_data')
@Index('idx_telemetry_vehicle_timestamp', ['vehicleId', 'timestamp'])
@Index('idx_telemetry_sensor_timestamp', ['sensorId', 'timestamp'])
@Index('idx_telemetry_timestamp', ['timestamp'])
export class TelemetryDataEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    vehicleId: string;

    @Column({ length: 100 })
    sensorId: string;

    @Column('timestamp with time zone')
    timestamp: Date;

    @Column('jsonb')
    data: TelemetryReading;

    @Column('jsonb', { nullable: true })
    location: GeoLocation;

    @Column({
        type: 'enum',
        enum: DataQuality,
        default: DataQuality.MEDIUM,
    })
    quality: DataQuality;

    @Column({ nullable: true })
    blockchainTxHash: string;

    @Column({ default: false })
    isProcessed: boolean;

    @Column({ default: false })
    isStored: boolean;

    @Column({ type: 'timestamp', nullable: true })
    processedAt: Date;

    @Column({ type: 'integer', default: 0 })
    processingAttempts: number;

    @Column({ type: 'timestamp', nullable: true })
    lastProcessingAttempt: Date;


    @Column({ type: 'text', nullable: true })
    lastError: string;

    @CreateDateColumn()
    createdAt: Date;

    // Relationships
    @ManyToOne(() => VehicleIdentityEntity, (vehicle) => vehicle.telemetryData)
    @JoinColumn({ name: 'vehicleId', referencedColumnName: 'vehicleId' })
    vehicle: VehicleIdentityEntity;

    @ManyToOne(() => SensorIdentityEntity, (sensor) => sensor.telemetryData)
    @JoinColumn({ name: 'sensorId', referencedColumnName: 'id' })
    sensor: SensorIdentityEntity;
}