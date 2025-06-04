import * as Joi from 'joi';

export const validationSchema = Joi.object({
    // App configuration
    PORT: Joi.number().default(5000),
    NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
    API_VERSION: Joi.string().default('v1'),

    // Database configuration
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().default('postgres'),
    DB_PASSWORD: Joi.string().default('password'),
    DB_DATABASE: Joi.string().default('axi_peaq_integration'),

    // Redis configuration
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional(),

    // Blockchain configuration
    PEAQ_MAIN_WS_URL: Joi.string().uri().default('wss://wss.peaq.network'),
    PEAQ_KREST_WS_URL: Joi.string().uri().default('wss://wss-krest.peaq.network'),
    PEAQ_AGUNG_WS_URL: Joi.string().uri().default('wss://wss-agung.peaq.network'),
    PEAQ_MAIN_RPC_URL: Joi.string().uri().default('https://rpc.peaq.network'),
    PEAQ_KREST_RPC_URL: Joi.string().uri().default('https://rpc-krest.peaq.network'),
    PEAQ_AGUNG_RPC_URL: Joi.string().uri().default('https://rpc-agung.peaq.network'),
    BLOCKCHAIN_TIMEOUT: Joi.number().default(30000),

    // Security
    JWT_SECRET: Joi.string().default('your-super-secret-jwt-key'),
    JWT_EXPIRATION: Joi.string().default('1h'),

    // Smart Contract
    PRIVATE_KEY: Joi.string().optional(),
    DEFAULT_GAS_LIMIT: Joi.string().default('2000000'),
    DEFAULT_GAS_PRICE: Joi.string().default('20000000000'),
});