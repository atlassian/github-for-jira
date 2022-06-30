import Logger, { createLogger, INFO, levelFromName, stdSerializers } from "bunyan";
import bformat from "bunyan-format";
import { filteringHttpLogsStream } from "utils/filtering-http-logs-stream";
import { Request } from "express";
import { AxiosResponse } from "axios";
import { createHashWithSharedSecret } from "utils/encryption";

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

const responseSerializer = (res: AxiosResponse) => ({
	...stdSerializers.res(res),
	config: res?.config,
	request: requestSerializer(res.request)
});

const requestSerializer = (req: Request) => (!req || !req.socket) ? req : {
	method: req.method,
	url: req.originalUrl || req.url,
	path: req.path,
	headers: req.headers,
	remoteAddress: req.socket.remoteAddress,
	remotePort: req.socket.remotePort,
	body: req.body
};

const errorSerializer = (err) => err && {
	...err,
	response: stdSerializers.res(err.response),
	request: requestSerializer(err.request)
};

const hashSerializer = (data: any): string | undefined => {
	if (data === undefined || data == null) {
		return undefined;
	}
	return createHashWithSharedSecret(data);
};

const sensitiveDataSerializers = (): Logger.Serializers => ({
	jiraHost: hashSerializer,
	orgName: hashSerializer,
	repoName: hashSerializer,
	userGroup: hashSerializer,
	aaid: hashSerializer,
	username: hashSerializer
});

const logLevel = process.env.LOG_LEVEL || "info";
const globalLoggingLevel = levelFromName[logLevel] || INFO;

// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// Remove  Default Probot Logging Stream
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(probotLogger as any).streams.pop();

	// Replace with formatOut stream
	probotLogger.addStream({
		type: "stream",
		stream: LOG_STREAM,
		closeOnExit: false,
		level: globalLoggingLevel
	});
};

const createNewLogger = (name: string, fields?: Record<string, unknown>): Logger => {
	return createLogger(
		{
			name,
			stream: LOG_STREAM,
			level: globalLoggingLevel,
			serializers: {
				err: errorSerializer,
				res: responseSerializer,
				req: requestSerializer
			},
			...fields
		});
};

export const getLogger = (name: string, fields?: Record<string, unknown>): Logger => {
	const logger = createNewLogger(name);
	logger.addSerializers(sensitiveDataSerializers());
	return logger.child({ ...fields });
};

// This will log data to a restricted environment [env]-unsafe and not serialize sensitive data
export const getUnsafeLogger = (name: string, fields?: Record<string, unknown>): Logger => {
	const logger = createNewLogger(name, { env_suffix: "unsafe" });
	return logger.child({ ...fields });
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
