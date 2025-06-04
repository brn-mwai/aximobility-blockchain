import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { SensorType, SensorSpecifications, SensorId, DIDIdentifier } from '@/common/types';
import { VehicleIdentityEntity } from './vehicle-identity.entity';
import { TelemetryDataEntity } from './telemetry-data.entity';

@Entity('sensor_identities')
@Index('idx_sensor_did_identifier', ['didIdentifier'], { unique: true })
@Index('idx_sensor_vehicle_type', ['vehicleId', 'sensorType'])
export class SensorIdentityEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 255 })
    didIdentifier: string;

    @Column({
        type: 'enum',
        enum: SensorType,
    })
    sensorType: SensorType;

    @Column({ length: 100 })
    vehicleId: string;

    @Column('jsonb')
    specifications: SensorSpecifications;

    @Column('jsonb', { nullable: true })
    calibrationData: Record<string, any>;

    @Column({ nullable: true })
    blockchainTxHash: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: true })
    isCalibrated: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relationships
    @ManyToOne(() => VehicleIdentityEntity, (vehicle) => vehicle.sensors)
    @JoinColumn({ name: 'vehicleId', referencedColumnName: 'vehicleId' })
    vehicle: VehicleIdentityEntity;

    @OneToMany(() => TelemetryDataEntity, (telemetry) => telemetry.sensor)
    telemetryData: TelemetryDataEntity[];
}