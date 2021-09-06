import { config as loadConfig } from 'dotenv';

loadConfig();

export const config = process.env;
