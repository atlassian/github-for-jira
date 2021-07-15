import envVars from './env';
import {bootstrap} from 'global-agent';
import Logger from 'bunyan';

const logger = new Logger({name:'proxy'});

if(envVars.PROXY){
  logger.info(`configuring proxy: ${envVars.PROXY} for outbound calls`);
  process.env.GLOBAL_AGENT_HTTP_PROXY = envVars.PROXY;
  bootstrap();
}else{
  logger.info('configuring no proxy for outbound calls');
}


