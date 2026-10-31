import { config } from 'dotenv';

config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USERNAME = 'postgres';
process.env.DATABASE_PASSWORD = 'postgres';
process.env.DATABASE_NAME = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '0';
process.env.THROTTLE_TTL = '60';
process.env.THROTTLE_LIMIT = '100';
