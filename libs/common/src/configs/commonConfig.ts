import {
  ConfigT,
} from './configTypes';

export interface CommonConfigT {
  domainApi: string,
  domainApiHttp?: string,
  domainAdmin: string, // web domain for trainers dashboard
}

export const commonConfig: ConfigT<CommonConfigT> = {
  dev: {
    domainApi: 'https://localhost:3334/api/',
    domainApiHttp: 'http://localhost:3333/api/',
    domainAdmin: 'https://localhost:3000/',
  },
  prod: {
    domainApi: 'https://define-dom.com:3001/api/',
    domainAdmin: 'https://define-dom.com/',
  },
};
