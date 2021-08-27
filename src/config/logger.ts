import Logger, { levelFromName } from "bunyan";
import bformat from "bunyan-format";
import filteringStream from "../common/filteringStream";
import { LoggerWithTarget, wrapLogger } from "probot/lib/wrap-logger";


// For any Micros env we want the logs to be in JSON format.
// Otherwise, if local development, we want human readable logs.
const outputMode = process.env.MICROS_ENV ? "json" : "short";

// add levelInString to include DEBUG | ERROR | INFO | WARN
const formatOut = filteringStream(bformat({ outputMode, levelInString: true }));

const logger = Logger.createLogger(
	{
		name: "github-for-jira",
		logger: "config.logger",
		stream: formatOut
	}
);

const logLevel = process.env.LOG_LEVEL || "info";
const globalLoggingLevel = levelFromName[logLevel] || Logger.INFO;
logger.level(globalLoggingLevel);


// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore

	// Remove  Default Probot Logging Stream
	probotLogger.streams.pop();

	// Replace with formatOut stream
	probotLogger.addStream({
		type: "stream",
		stream: formatOut,
		closeOnExit: false,
		level: globalLoggingLevel
	});
};

export const getLogger = (name: string): LoggerWithTarget => {
	return wrapLogger(logger.child({ logger: name }));
};

//Override console.log with bunyan logger.
//we shouldn't use console.log in our code, but it is done to catch
//possible logs from third party libraries
const consoleLogger = getLogger("console");
// eslint-disable-next-line no-console
console.debug = consoleLogger.debug.bind(consoleLogger);
// eslint-disable-next-line no-console
console.error = consoleLogger.error.bind(consoleLogger);
// eslint-disable-next-line no-console
console.log = consoleLogger.info.bind(consoleLogger);
// eslint-disable-next-line no-console
console.warn = consoleLogger.warn.bind(consoleLogger);


export default logger;

