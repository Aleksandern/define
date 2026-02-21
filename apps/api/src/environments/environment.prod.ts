import {
  commonConfig,
} from '@define/common/configs';

import {
  EnvironmentT,
} from '@appApi/types';

export const environmentProd = (): EnvironmentT => ({
  environment: 'production',
  production: true,
  common: commonConfig.prod,
  database: {
    mongoUri: 'mongodb://localhost:27017/define-dev',
  },
});
