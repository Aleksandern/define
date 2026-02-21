import {
  CommonConfigT,
} from '@define/common/configs';

export interface EnvironmentT {
  environment: 'development' | 'production',
  production: boolean,
  common: CommonConfigT,
  database: {
    mongoUri: string,
  },
}
