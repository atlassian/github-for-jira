import Logger, { createLogger, LogLevel, Serializers, stdSerializers, Stream } from "bunyan";
import { isArray, isString, merge, omit } from "lodash";
import { SafeRawLogStream, UnsafeRawLogStream } from "utils/logger-utils";

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

const loggerStreamSafe = (): Logger.Stream => ({
	type: "raw",
	stream: new SafeRawLogStream(),
	closeOnExit: false
});

const loggerStreamUnsafe = (): Logger.Stream => ({
	type: "raw",
	stream: new UnsafeRawLogStream(),
	closeOnExit: false
});

// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// Remove  Default Probot Logging Stream
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(probotLogger as any).streams.pop();

	// Replace with formatOut stream
	probotLogger.addStream(loggerStreamSafe());
	probotLogger.addStream(loggerStreamUnsafe());
};

interface LoggerOptions {
	fields?: Record<string, unknown>;
	streams?: Stream[];
	level?: LogLevel;
	stream?: NodeJS.WritableStream;
	serializers?: Serializers;
	src?: boolean;
	filterHttpRequests?: boolean;
}

export const getLogger = (name: string, options: LoggerOptions = {}): Logger => {
	return createLogger(merge<Logger.LoggerOptions, LoggerOptions>({
		name,
		streams: [
			loggerStreamSafe(),
			loggerStreamUnsafe()
		],
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
