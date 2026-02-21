import { environmentDev } from './environment.dev';
import { environmentProd } from './environment.prod';

const isProd = process.env.ENV === 'production';
export const configEnv = isProd ? environmentProd : environmentDev;
