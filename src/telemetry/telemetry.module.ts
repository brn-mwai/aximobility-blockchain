import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';

import { TelemetryService } from './services/telemetry.service';
import { DataPipelineService } from './services/data-pipeline.service';
import { TelemetryValidationService } from './services/telemetry-validation.service';
import { TelemetryController } from './controllers/telemetry.controller';

// Imported blockchain modules for DID validation and storage
import { BlockchainModule } from '@/blockchain/blockchain.module';

@Module({
    imports: [ConfigModule, DatabaseModule, BlockchainModule],
    providers: [
        TelemetryService,
        DataPipelineService,
        TelemetryValidationService,
    ],
    controllers: [TelemetryController],
    exports: [
        TelemetryService,
        DataPipelineService,
        TelemetryValidationService,
    ],
})
export class TelemetryModule { }