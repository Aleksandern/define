import {
  commonConfig,
} from '@define/common/configs';

import {
  EnvironmentT,
} from '@appApi/types';

export const environmentDev = (): EnvironmentT => ({
  environment: 'development',
  production: false,
  common: commonConfig.dev,
  database: {
    mongoUri: 'mongodb://localhost:27017/define-dev',
  },
});
