import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';

import { ContractService } from './services/contract.service';
import { FareCalculatorService } from './services/fare-calculator.service';
import { TokenManagementService } from './services/token-management.service';
import { ContractsController } from './controllers/contracts.controller';

import { PeaqModule } from '../peaq/peaq.module';

@Module({
    imports: [ConfigModule, DatabaseModule, PeaqModule],
    providers: [ContractService, FareCalculatorService, TokenManagementService],
    controllers: [ContractsController],
    exports: [ContractService, FareCalculatorService, TokenManagementService],
})
export class ContractsModule { }