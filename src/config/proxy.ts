import envVars from './env';
import {bootstrap} from 'global-agent';
import { getLogger } from './logger';

const logger = getLogger('config.proxy');

if(envVars.PROXY){
  logger.info(`configuring proxy: ${envVars.PROXY} for outbound calls`);
  process.env.GLOBAL_AGENT_HTTP_PROXY = envVars.PROXY;
  bootstrap();
}else{
  logger.info('configuring no proxy for outbound calls');
}


