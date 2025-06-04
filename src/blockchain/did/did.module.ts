import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';

import { DIDService } from './services/did.service';
import { VehicleDIDService } from './services/vehicle-did.service';
import { SensorDIDService } from './services/sensor-did.service';
import { DIDController } from './controllers/did.controller';

import { PeaqModule } from '../peaq/peaq.module';

@Module({
    imports: [ConfigModule, DatabaseModule, PeaqModule],
    providers: [DIDService, VehicleDIDService, SensorDIDService],
    controllers: [DIDController],
    exports: [DIDService, VehicleDIDService, SensorDIDService],
})
export class DIDModule { }
