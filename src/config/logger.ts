import Logger, { createLogger, LogLevel, Serializers, Stream } from "bunyan";
import { isArray, isString, merge, omit, mapKeys } from "lodash";
import { SafeRawLogStream, UnsafeRawLogStream } from "utils/logger-utils";
import { createHashWithSharedSecret } from "utils/encryption";

const REPO_URL_REGEX = /^(\/api\/v3)?\/repos\/([^/]+)\/([^/]+)\/(.*)$/;

const maybeRemoveOrgAndRepo = (url: string) => {
	if (url.match(REPO_URL_REGEX)) {
		return url.replace(REPO_URL_REGEX, (_, maybeV3Prefix, org, repo, rest) => {
			return [
				maybeV3Prefix,
				"repos",
				createHashWithSharedSecret(decodeURIComponent(org)),
				createHashWithSharedSecret(decodeURIComponent(repo)),
				rest
			].join("/");
		});
	}
	return url;
};

const COMPARE_URL_REGEX = /^(.*)\/compare\/(.*)\.\.\.(.*)$/;

const isCompareUrl = (url: string) => url.match(COMPARE_URL_REGEX);

const removeBranchesFromCompareUrl = (url: string) =>
	url.replace(COMPARE_URL_REGEX, (_, prefix, branch1, branch2) => {
		return [
			prefix,
			"compare",
			createHashWithSharedSecret(decodeURIComponent(branch1)) + "..." +
			createHashWithSharedSecret(decodeURIComponent(branch2))
		].join("/");
	});

const GIT_REF_URL_REGEX = /^(.*)\/git\/ref\/([^/]+)$/;

const isGitRefUrl = (url: string) => url.match(GIT_REF_URL_REGEX);

const removeGitRefFromUrl = (url: string) =>
	url.replace(GIT_REF_URL_REGEX, (_, prefix, gitRef) =>
		`${prefix}/git/ref/${createHashWithSharedSecret(decodeURIComponent(gitRef))}`
	);

const USERS_URL_REGEX = /^(\/api\/v3)?\/users\/([^/]+)$/;

const isUsersUrl = (url: string) => url.match(USERS_URL_REGEX);

const removeUserFromUrl = (url: string) =>
	url.replace(USERS_URL_REGEX, (_, maybeV3Prefix, userName) =>
		[
			maybeV3Prefix,
			"users",
			createHashWithSharedSecret(decodeURIComponent(userName))
		].join("/")
	);

const REST_DEVINFO_BRANCH_URL_REGEX = /^\/rest\/devinfo\/([^/]+)\/repository\/([^/]+)\/branch\/([^/?]+)\?_updateSequenceId=([0-9]+)$/;

const isDevInfoBranchUrl = (url: string) => url.match(REST_DEVINFO_BRANCH_URL_REGEX);

const removeBranchFromDevInfoUrl = (url: string) =>
	url.replace(REST_DEVINFO_BRANCH_URL_REGEX, (_, version, repoNo, branchaName, updateSequenceId) =>
		[
			"/rest/devinfo",
			version,
			"repository",
			repoNo,
			"branch",
			`${createHashWithSharedSecret(decodeURIComponent(branchaName))}?_updateSequenceId=${updateSequenceId}`
		].join("/")
	);

const SEARCH_URL_REGEX = /^\/search\/repositories\?q=([^&=]+)&order=updated$/;
const CENSORED_SEARCH_URL = "/search/repositories?q=CENSORED&order=updated";

const isSearchRepoUrl = (url: string) => url.match(SEARCH_URL_REGEX);

const censorUrl = (url) => {
	if (!url) {
		return url;
	}
	if (typeof url === "string") {
		if (!url.startsWith("/")) {
			const censoredUrl = censorUrl("/" + url);
			return censoredUrl.substr(1);
		}

		const censoredUrl = maybeRemoveOrgAndRepo(url);

		if (isCompareUrl(censoredUrl)) {
			return removeBranchesFromCompareUrl(censoredUrl);

		} else if (isGitRefUrl(censoredUrl)) {
			return removeGitRefFromUrl(censoredUrl);

		} else if (isUsersUrl(censoredUrl)) {
			return removeUserFromUrl(censoredUrl);

		} else if (isDevInfoBranchUrl(censoredUrl)) {
			return removeBranchFromDevInfoUrl(censoredUrl);

		} else if (isSearchRepoUrl(censoredUrl)) {
			return CENSORED_SEARCH_URL;
		}

		return censoredUrl;
	}
	return url;
};

const SENSITIVE_HEADERS_TO_CENSOR = ["authorization", "set-cookie", "cookie"];

const headersSerializer = (headers) => {
	if (!headers) {
		return headers;
	}

	const ret = mapKeys(headers, (_, key) => key.toLowerCase());

	SENSITIVE_HEADERS_TO_CENSOR.forEach(headerName => {
		if (ret[headerName]) {
			ret[headerName] = "CENSORED";
		}
	});
	return ret;
};

const responseConfigSerializer = (config) => {
	if (!config) {
		return config;
	}
	return {
		url: censorUrl(config.url),
		method: config.method,
		status: config.status,
		statusText: config.statusText,
		headers: headersSerializer(config.headers)
	};
};

const responseSerializer = (res) => {
	if (!res) {
		return res;
	}
	return {
		status: res.status,
		statusText: res.statusText,
		headers: headersSerializer(res.headers),
		config: responseConfigSerializer(res.config),
		request: requestSerializer(res.request)
	};
};

const requestSerializer = (req) => req && ({
	method: req.method,
	url: censorUrl(req.originalUrl || req.url),
	path: censorUrl(req.path),
	headers: headersSerializer(req.headers),
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
		message: err?.message,
		config: responseConfigSerializer(err.config),
		response: responseSerializer(err.response),
		request: requestSerializer(err.request)
	};
};

const taskSerializer = (task) => {
	if (!task) {
		return task;
	}
	const repository = task.repository ? {
		fullName: createHashWithSharedSecret(task.repository.full_name),
		id: task.repository.id,
		name: createHashWithSharedSecret(task.repository.name),
		owner: {
			login: createHashWithSharedSecret(task.repository.owner?.login)
		},
		updatedAt: task.repository.updated_at
	} : {};

	return {
		...task,
		repository
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
	unsafe?: boolean;
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
			request: requestSerializer,
			requestPath: censorUrl,
			task: taskSerializer,
			nextTask: taskSerializer
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
