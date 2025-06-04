export default () => ({
    app: {
        port: parseInt(process.env.PORT || '5000', 10),
        environment: process.env.NODE_ENV || 'development',
        globalPrefix: 'api',
        versioning: {
            enable: true,
            prefix: 'v',
            defaultVersion: '1',
        },
    },
    blockchain: {
        peaq: {
            networks: {
                main: process.env.PEAQ_MAIN_WS_URL || 'wss://wss.peaq.network',
                krest: process.env.PEAQ_KREST_WS_URL || 'wss://wss-krest.peaq.network',
                agung: process.env.PEAQ_AGUNG_WS_URL || 'wss://wss-agung.peaq.network',
            },
            rpc: {
                main: process.env.PEAQ_MAIN_RPC_URL || 'https://rpc.peaq.network',
                krest: process.env.PEAQ_KREST_RPC_URL || 'https://rpc-krest.peaq.network',
                agung: process.env.PEAQ_AGUNG_RPC_URL || 'https://rpc-agung.peaq.network',
            },
            defaultNetwork: process.env.PEAQ_DEFAULT_NETWORK || 'krest',
            timeout: parseInt(process.env.BLOCKCHAIN_TIMEOUT || '30000', 10),
            retryAttempts: parseInt(process.env.BLOCKCHAIN_RETRY_ATTEMPTS || '3', 10),
            retryDelay: parseInt(process.env.BLOCKCHAIN_RETRY_DELAY || '1000', 10),
        },
        contracts: {
            gasLimit: process.env.DEFAULT_GAS_LIMIT || '2000000',
            gasPrice: process.env.DEFAULT_GAS_PRICE || '20000000000',
        },
    },
    database: {
        type: 'postgres' as const,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'axi_peaq_integration',
        entities: ['dist/**/*.entity{.ts,.js}'],
        migrations: ['dist/database/migrations/*{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.DB_LOGGING === 'true',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    },
    security: {
        jwt: {
            secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
            expiresIn: process.env.JWT_EXPIRATION || '1h',
        },
        bcrypt: {
            rounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
        },
    },
    swagger: {
        title: 'AXI Peaq Integration API',
        description: 'API for AXI Mobility blockchain integration with Peaq Network',
        version: '1.0.0',
        path: 'docs',
    },
    telemetry: {
        batchSize: parseInt(process.env.TELEMETRY_BATCH_SIZE || '100', 10),
        batchTimeout: parseInt(process.env.TELEMETRY_BATCH_TIMEOUT || '5000', 10),
        maxRetries: parseInt(process.env.TELEMETRY_MAX_RETRIES || '3', 10),
    },
});