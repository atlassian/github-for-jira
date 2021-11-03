import Logger, { levelFromName } from "bunyan";
import bformat from "bunyan-format";
import filteringHttpLogsStream from "../util/filteringHttpLogsStream";
import { LoggerWithTarget, wrapLogger } from "probot/lib/wrap-logger";
import { Request } from "express";

// For any Micros env we want the logs to be in JSON format.
// Otherwise, if local development, we want human readable logs.
const outputMode = process.env.MICROS_ENV ? "json" : "short";

// We cannot redefine the stream on middleware level (when we create the child logger),
// therefore we have to do it here, on global level, for all loggers :(
// And there's no way to disable those for webhooks, see:
//   https://github.com/probot/probot/issues/1577
//   https://github.com/probot/probot/issues/598
//
export const FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME = "frontend-log-middleware";
// add levelInString to include DEBUG | ERROR | INFO | WARN
const LOG_STREAM = filteringHttpLogsStream(FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME,
	bformat({ outputMode, levelInString: true })
);

const requestSerializer = (req: Request) => (!req || !req.socket) ? req : {
	method: req.method,
	url: req.originalUrl || req.url,
	path: req.path,
	headers: req.headers,
	remoteAddress: req.socket.remoteAddress,
	remotePort: req.socket.remotePort,
	body: req.body
};

const errorSerializer = (err) => (!err || !err.stack) ? err : {
	...err,
	response: Logger.stdSerializers.res(err.response),
	request: requestSerializer(err.request),
	stack: getFullErrorStack(err)
};

const getFullErrorStack = (ex) => {
	let ret = ex.stack || ex.toString();
	if (ex.cause && typeof (ex.cause) === "function") {
		const cex = ex.cause();
		if (cex) {
			ret += "\nCaused by: " + getFullErrorStack(cex);
		}
	}
	return ret;
};

const logLevel = process.env.LOG_LEVEL || "info";
const globalLoggingLevel = levelFromName[logLevel] || Logger.INFO;

const logger = wrapLogger(Logger.createLogger(
	{
		name: "root-logger",
		stream: LOG_STREAM,
		level: globalLoggingLevel,
		serializers: {
			err: errorSerializer,
			res: Logger.stdSerializers.res,
			req: requestSerializer
		}
	}
));

// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore

	// Remove  Default Probot Logging Stream
	probotLogger.streams.pop();

	// Replace with formatOut stream
	probotLogger.addStream({
		type: "stream",
		stream: LOG_STREAM,
		closeOnExit: false,
		level: globalLoggingLevel
	});
};

export const getLogger = (name: string): LoggerWithTarget => {
	return logger.child({ name });
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
// console.log = consoleLogger.info.bind(consoleLogger);
// eslint-disable-next-line no-console
console.warn = consoleLogger.warn.bind(consoleLogger);


export default logger;

