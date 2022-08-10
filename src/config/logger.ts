import Logger, { createLogger, INFO, levelFromName, LoggerOptions, stdSerializers } from "bunyan";
import { RawLogStream } from "utils/logger-utils";
import { isArray, isString, omit } from "lodash";
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

const logLevel = process.env.LOG_LEVEL || "info";
const globalLoggingLevel = levelFromName[logLevel] || INFO;

const loggerStream = (isUnsafe) => ({
	type: "raw",
	stream: new RawLogStream(FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME, isUnsafe),
	closeOnExit: false,
	level: globalLoggingLevel
});

// TODO Remove after upgrading Probot to the latest version (override logger via constructor instead)
export const overrideProbotLoggingMethods = (probotLogger: Logger) => {
	// Remove  Default Probot Logging Stream
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(probotLogger as any).streams.pop();

	probotLogger.addStream(loggerStream(false));
	probotLogger.addStream(loggerStream(true));
};

const createNewLogger = (name: string, options: Partial<LoggerOptions> = {}): Logger => {
	return createLogger({
		name,
		streams: [
			loggerStream(false),
			loggerStream(true)
		],
		level: globalLoggingLevel,
		serializers: {
			err: errorSerializer,
			error: errorSerializer,
			res: responseSerializer,
			response: responseSerializer,
			req: requestSerializer,
			request: requestSerializer
		},
		...options
	});
};

export const getLogger = (name: string, fields?: Record<string, unknown>): Logger => {
	const logger = createNewLogger(name);
	return logger.child({ ...fields });
};

export const cloneAllowedLogFields = (fields: Record<string, unknown>) => omit(fields, ["name"]);

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
