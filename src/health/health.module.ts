import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';

import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { BlockchainHealthIndicator } from './indicators/blockchain.health';
import { RedisHealthIndicator } from './indicators/redis.health';

// Import services for health checks
import { BlockchainModule } from '@/blockchain/blockchain.module';

@Module({
    imports: [TerminusModule, HttpModule, BlockchainModule],
    providers: [
        DatabaseHealthIndicator,
        BlockchainHealthIndicator,
        RedisHealthIndicator,
    ],
    controllers: [HealthController],
})
export class HealthModule { }