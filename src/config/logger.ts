import Logger, { createLogger, LogLevel, Serializers, Stream } from "bunyan";
import { isArray, isString, merge, omit } from "lodash";
import { SafeRawLogStream, UnsafeRawLogStream } from "utils/logger-utils";

function censorUrl(url) {
	if (!url) {
		return url;
	}
	if (typeof url === "string") {
		if (url.includes("/repos") && url.includes(".jira/config.yml")) {
			return "CENSORED-PATH-TO-JIRA-CONFIG-YML";
		}
		if (url.includes("/rest/devinfo/0.10/repository/") && url.includes("/branch/")) {
			const splitUrl = url.split("/branch/", 2);
			return `${splitUrl[0]}/branch/CENSORED`;
		}
	}
	return url;
}

const responseConfigSerializer = (config) => {
	if (!config) {
		return config;
	}
	return {
		url: censorUrl(config.url),
		method: config.method,
		status: config.status,
		statusText: config.statusText,
		headers: config.headers
	};
};

const responseSerializer = (res) => {
	if (!res) {
		return res;
	}
	return {
		status: res.status,
		statusText: res.statusText,
		headers: res.headers,
		config: responseConfigSerializer(res.config),
		request: requestSerializer(res.request)
	};
};

const requestSerializer = (req) => req && ({
	method: req.method,
	url: censorUrl(req.originalUrl || req.url),
	path: censorUrl(req.path),
	headers: req.headers,
	remoteAddress: req.socket?.remoteAddress,
	remotePort: req.socket?.remotePort
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
		config: responseConfigSerializer(err.config),
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
			config: responseConfigSerializer,
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
