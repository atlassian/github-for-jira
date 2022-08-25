import Logger, { createLogger, LogLevel, Serializers, stdSerializers, Stream } from "bunyan";
import { isArray, isString, merge, omit } from "lodash";
import { SafeRawLogStream, UnsafeRawLogStream } from "utils/logger-utils";

export const FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME = "frontend-log-middleware";

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

export const defaultLogLevel: LogLevel = process.env.LOG_LEVEL as LogLevel || "info";

const loggerStream = (safe = true): Logger.Stream => ({
	type: "raw",
	stream: safe ? new SafeRawLogStream(FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME) : new UnsafeRawLogStream(FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME),
	closeOnExit: false
});

// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// Remove  Default Probot Logging Stream
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(probotLogger as any).streams.pop();

	// Replace with formatOut stream
	probotLogger.addStream(loggerStream());
	probotLogger.addStream(loggerStream(false));
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
	return createLogger(merge<Logger.LoggerOptions, LoggerOptions>({
		name,
		streams: [ loggerStream(), loggerStream(false) ],
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
