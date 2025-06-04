import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';

import { PeaqService } from './services/peaq.service';
import { PeaqController } from './controllers/peaq.controller';
import { NetworkHealthService } from './services/network-health.service';

@Module({
    imports: [ConfigModule, DatabaseModule],
    providers: [PeaqService, NetworkHealthService],
    controllers: [PeaqController],
    exports: [PeaqService, NetworkHealthService],
})
export class PeaqModule { }