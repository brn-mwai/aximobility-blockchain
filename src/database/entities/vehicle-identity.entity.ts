import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { VehicleAttributes, VehicleId, DIDIdentifier } from '@/common/types';
import { SensorIdentityEntity } from './sensor-identity.entity';
import { TelemetryDataEntity } from './telemetry-data.entity';

@Entity('vehicle_identities')
@Index('idx_vehicle_did_identifier', ['didIdentifier'], { unique: true })
@Index('idx_vehicle_vehicle_id', ['vehicleId'], { unique: true })
export class VehicleIdentityEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 255 })
    didIdentifier: string;

    @Column({ unique: true, length: 100 })
    vehicleId: string;

    @Column('jsonb')
    attributes: VehicleAttributes;

    @Column({ length: 255 })
    owner: string;

    @Column({ nullable: true })
    blockchainTxHash: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relationships
    @OneToMany(() => SensorIdentityEntity, (sensor) => sensor.vehicle)
    sensors: SensorIdentityEntity[];

    @OneToMany(() => TelemetryDataEntity, (telemetry) => telemetry.vehicle)
    telemetryData: TelemetryDataEntity[];
}