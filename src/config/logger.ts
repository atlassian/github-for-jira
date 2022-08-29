import Logger, { createLogger, LogLevel, Serializers, stdSerializers, Stream } from "bunyan";
import { filteringHttpLogsStream } from "utils/filtering-http-logs-stream";
import { createHashWithSharedSecret } from "utils/encryption";
import bformat from "bunyan-format";
import { isArray, isString, merge, omit } from "lodash";

// For any Micros env we want the logs to be in JSON format.
// Otherwise, if local development, we want human readable logs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outputMode: any = process.env.MICROS_ENV ? "json" : "short";

// We cannot redefine the stream on middleware level (when we create the child logger),
// therefore we have to do it here, on global level, for all loggers :(
// And there's no way to disable those for webhooks, see:
//   https://github.com/probot/probot/issues/1577
//   https://github.com/probot/probot/issues/598
//
export const FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME = "frontend-log-middleware";
// add levelInString to include DEBUG | ERROR | INFO | WARN
const LOG_STREAM = filteringHttpLogsStream(
	FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME,
	bformat({ outputMode, levelInString: true })
);

const responseSerializer = (res) => res && ({
	...stdSerializers.res(res),
	config: res.config,
	request: requestSerializer(res.request)
});

const requestSerializer = (req) => req && ({
	method: req.method,
	url: req.originalUrl || req.url,
	path: req.path,
	headers: req.headers,
	remoteAddress: req.socket?.remoteAddress,
	remotePort: req.socket?.remotePort,
	body: req.body
});

const errorSerializer = (err) => {
	if (!err) {
		return err;
	}

	if (isArray(err)) {
		err = { data: err };
	} else if (isString(err)) {
		err = { message: err };
	}

	return {
		...err,
		response: responseSerializer(err.response),
		request: requestSerializer(err.request)
	};
};

const hashSerializer = (data?: string): string | undefined => {
	if (!data || !isString(data)) {
		return undefined;
	}
	return createHashWithSharedSecret(data);
};

export const defaultLogLevel: LogLevel = process.env.LOG_LEVEL as LogLevel || "info";

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
		level: defaultLogLevel
	});
};

const createNewLogger = (name: string, options: LoggerOptions = {}): Logger => {
	return createLogger(merge<Logger.LoggerOptions, LoggerOptions>({
		name,
		stream: LOG_STREAM,
		level: defaultLogLevel,
		serializers: {
			err: errorSerializer,
			error: errorSerializer,
			res: responseSerializer,
			response: responseSerializer,
			req: requestSerializer,
			request: requestSerializer
		},
		...options.fields
	}, omit(options, "fields")));
};

interface LoggerOptions {
	fields?: Record<string, unknown>;
	streams?: Stream[];
	level?: LogLevel;
	stream?: NodeJS.WritableStream;
	serializers?: Serializers;
	src?: boolean;
}

export const getLogger = (name: string, options: LoggerOptions = {}): Logger => {
	return createNewLogger(name, merge({
		serializers: {
			jiraHost: hashSerializer,
			orgName: hashSerializer,
			repoName: hashSerializer,
			userGroup: hashSerializer,
			aaid: hashSerializer,
			username: hashSerializer
		}
	}, options));

};

// This will log data to a restricted environment [env]-unsafe and not serialize sensitive data
export const getUnsafeLogger = (name: string, options: LoggerOptions = {}): Logger => {
	return createNewLogger(name, options);
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
