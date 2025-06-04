import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Sub-modules
import { PeaqModule } from './peaq/peaq.module';
import { DIDModule } from './did/did.module';
import { ContractsModule } from './contracts/contracts.module';

@Module({
    imports: [
        ConfigModule,
        PeaqModule,
        DIDModule,
        ContractsModule,
    ],
    exports: [
        PeaqModule,
        DIDModule,
        ContractsModule,
    ],
})
export class BlockchainModule { }