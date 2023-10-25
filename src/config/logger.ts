/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Logger, { createLogger, LogLevel, Serializers, Stream } from "bunyan";
import { isArray, isString, merge, omit, mapKeys } from "lodash";
import { SafeRawLogStream } from "utils/logger-utils";
import { createHashWithSharedSecret } from "utils/encryption";
import { canLogHeader } from "utils/http-headers";

const REPO_URL_REGEX = /^(\/api\/v3)?\/repos\/([^/]+)\/([^/]+)\/(.*)$/;

const maybeRemoveOrgAndRepo = (url: string) => {
	if (url.match(REPO_URL_REGEX)) {
		return url.replace(REPO_URL_REGEX, (_, maybeV3Prefix: string, org: string, repo: string, rest: string) => {
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
	url.replace(COMPARE_URL_REGEX, (_, prefix: string, branch1: string, branch2: string) => {
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
	url.replace(GIT_REF_URL_REGEX, (_, prefix: string, gitRef: string) =>
		`${prefix}/git/ref/${createHashWithSharedSecret(decodeURIComponent(gitRef))}`
	);

const USERS_URL_REGEX = /^(\/api\/v3)?\/users\/([^/]+)$/;

const isUsersUrl = (url: string) => url.match(USERS_URL_REGEX);

const removeUserFromUrl = (url: string) =>
	url.replace(USERS_URL_REGEX, (_, maybeV3Prefix: string, userName: string) =>
		[
			maybeV3Prefix,
			"users",
			createHashWithSharedSecret(decodeURIComponent(userName))
		].join("/")
	);

const REST_DEVINFO_BRANCH_URL_REGEX = /^\/rest\/devinfo\/([^/]+)\/repository\/([^/]+)\/branch\/([^/?]+)\?_updateSequenceId=([0-9]+)$/;

const isDevInfoBranchUrl = (url: string) => url.match(REST_DEVINFO_BRANCH_URL_REGEX);

const removeBranchFromDevInfoUrl = (url: string) =>
	url.replace(REST_DEVINFO_BRANCH_URL_REGEX, (_, version: string, repoNo: string, branchaName: string, updateSequenceId: string) =>
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

const CREATE_BRANCH_PAGE_BRANCHES_URL_REGEX = /^(.*)\/owners\/([^/]+)\/repos\/([^/]+)\/branches(.*)$/;
const isCreateBranchPageBranchesUrl = (url: string) => url.match(CREATE_BRANCH_PAGE_BRANCHES_URL_REGEX);

const JIRA_HOST_QUERY_PARAM_REGEX = /jiraHost=(https%3A%2F%2F[\w-]+\.atlassian\.net)/;

const maybeCensorJiraHostInQueryParams = (url: string) => {
	if (url.match(JIRA_HOST_QUERY_PARAM_REGEX)) {
		return url.replace(JIRA_HOST_QUERY_PARAM_REGEX, (_, jiraHostEncoded: string) =>
			`jiraHost=${createHashWithSharedSecret(decodeURIComponent(jiraHostEncoded))}`);
	}
	return url;
};


const removeOwnersAndReposFromUrl = (url: string) =>
	url.replace(CREATE_BRANCH_PAGE_BRANCHES_URL_REGEX, (_, prefix: string, owners: string, repos: string, suffix: string) =>
		[
			prefix,
			"owners",
			createHashWithSharedSecret(decodeURIComponent(owners)),
			"repos",
			createHashWithSharedSecret(decodeURIComponent(repos)),
			"branches"
		].join("/") + suffix
	);

const censorUrl = (url: string): string => {
	if (!url) {
		return url;
	}
	if (typeof url === "string") {
		if (!url.startsWith("/")) {
			const censoredUrl = censorUrl("/" + url);
			return censoredUrl.substr(1);
		}

		const censoredUrl =
			maybeCensorJiraHostInQueryParams(
				maybeRemoveOrgAndRepo(
					url
				));

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

		} else if (isCreateBranchPageBranchesUrl(censoredUrl)) {
			return removeOwnersAndReposFromUrl(censoredUrl);
		}

		return censoredUrl;
	}
	return url;
};

const MSG_WITH_REPO_NAME_REGEX = /^(.*) Repository with the name '(.*)\/(.*)'.$/;

const censorMessage = (msg: string): string => {
	if (!msg) {
		return msg;
	}
	if (typeof msg === "string") {
		if (msg.match(MSG_WITH_REPO_NAME_REGEX)) {
			return msg.replace(MSG_WITH_REPO_NAME_REGEX, (_, prefix: string, orgName: string, repoName: string) => {
				return [
					prefix,
					"Repository with the name",
					`'${createHashWithSharedSecret(orgName)}/${createHashWithSharedSecret(repoName)}'.`
				].join(" ");
			});
		}
	}
	return msg;
};

const headersSerializer = (headers) => {
	if (!headers) {
		return headers;
	}

	const ret = mapKeys(headers, (_, key) => key.toLowerCase());

	for (const key in ret) {
		if (!canLogHeader(key)) {
			ret[key] = "CENSORED";
		}
	}

	return ret;
};

const axiosConfigSerializer = (config) => {
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

const responseSerializer = (res, includeConfig = true, includeRequest = true) => {
	if (!res) {
		return res;
	}
	return {
		status: res.status,
		statusText: res.statusText,
		headers: headersSerializer(res.headers),
		...((includeConfig && res.config) ? { config: axiosConfigSerializer(res.config) } : { }),
		...((includeRequest && res.request) ? { request: requestSerializer(res.request) } : { })
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

const graphQlErrorsSerializer = (errors: Array<any>) => (
	{
		errors: errors.map(error => errorSerializer(error))
	}
);

const sanitiseStackTrace = (stack: string) => {
	const splitAndSanitised = stack.split("\n").map(line => line.trim()).filter(line => line.startsWith("at "));
	if (splitAndSanitised.length > 10) {
		return splitAndSanitised.splice(0, 10).join("\n") + "\n...";
	} else {
		return splitAndSanitised.join("\n");
	}
};

const errorSerializer = (err) => {
	if (!err) {
		return err;
	}

	if (isArray(err)) {
		err = { data: err };
	} else if (isString(err)) {
		err = { message: err };
	}

	const res = {
		...err,
		... (err.cause && err.cause !== err ? { cause: errorSerializer(err.cause) } : { }),
		message: censorMessage(err.message),
		config: axiosConfigSerializer(err.config),
		response: responseSerializer(err.response, false, !err.request),
		request: requestSerializer(err.request),
		... (err.errors && Array.isArray(err.errors) ? graphQlErrorsSerializer(err.errors) : { }),
		... (err.task ? { task: taskSerializer(err.task) } : { }),
		... (err.stack ? { stack: sanitiseStackTrace(err.stack.toString()) } : { })
	};

	delete res.toJSON;
	if (err.response && err.request) {
		delete res.config;
	}

	return res;
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
			loggerStreamSafe()
		],
		level: defaultLogLevel,
		serializers: {
			err: errorSerializer,
			error: errorSerializer,
			cause: errorSerializer,
			config: axiosConfigSerializer,
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
