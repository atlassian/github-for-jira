import { envVars }  from "./env";
import { getLogger } from "./logger";

const logger = getLogger("config.proxy");

if (envVars.PROXY) {
	logger.info("configuring no proxy for outbound calls");
} else {
	logger.info("configuring no proxy for outbound calls");
}


