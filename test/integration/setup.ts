import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export async function createTestingModule(additionalProviders: any[] = []) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({
                envFilePath: '.env.test',
                isGlobal: true,
            }),
            TypeOrmModule.forRoot({
                type: 'sqlite',
                database: ':memory:',
                entities: ['src/**/*.entity{.ts,.js}'],
                synchronize: true,
                logging: false,
            }),
        ],
        providers: [
            ...additionalProviders,
            {
                provide: 'PEAQ_API',
                useValue: {
                    isReady: Promise.resolve(true),
                    query: {
                        system: { account: jest.fn() },
                    },
                    tx: {
                        peaqDid: { addAttribute: jest.fn() },
                    },
                    registry: {
                        hash: jest.fn(),
                        createType: jest.fn(),
                    },
                },
            },
        ],
    }).compile();

    return moduleFixture;
}