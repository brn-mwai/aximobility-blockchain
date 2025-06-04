import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { VehicleIdentityEntity } from './entities/vehicle-identity.entity';
import { SensorIdentityEntity } from './entities/sensor-identity.entity';
import { TelemetryDataEntity } from './entities/telemetry-data.entity';
import { BlockchainTransactionEntity } from './entities/blockchain-transaction.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            VehicleIdentityEntity,
            SensorIdentityEntity,
            TelemetryDataEntity,
            BlockchainTransactionEntity,
        ]),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule { }