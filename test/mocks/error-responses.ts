import { Task } from "~/src/sync/sync.types";

export const mockNotFoundErrorOctokitRequest = {
	status: 404,
	headers: {
		"access-control-allow-origin": "*"
	},
	request: {
		method: "GET",
		url: "https://api.github.com/repos/some-org/some-repo/pulls?per_page=20&page=1&state=all&sort=created&direction=desc",
		headers: {
			accept: "application/vnd.github.v3+json",
			"user-agent": "octokit.js/16.43.2 Node.js/14.17.6 (Linux 5.10; x64)",
			authorization: "token [REDACTED]"
		},
		request: {
			hook: "",
			validate: {},
			retries: 6,
			retryAfter: 10,
			retryCount: 6
		}
	},
	documentation_url:
		"https://docs.github.com/rest/reference/pulls#list-pull-requests"
};

export const mockNotFoundErrorOctokitGraphql = {
	data: {
		repository: null
	},
	errors: [
		{
			type: "NOT_FOUND",
			path: ["repository"],
			locations: [
				{
					line: 7,
					column: 3
				}
			],
			message:
				"Could not resolve to a Repository with the name 'some-org/some-repo'."
		}
	]
};

export const mockOtherOctokitRequestErrors = {
	status: 502,
	headers: {
		"access-control-allow-origin": "*"
	},
	request: {
		method: "GET",
		url: "https://api.github.com/repos/some-org/some-repo/pulls?per_page=20&page=1&state=all&sort=created&direction=desc",
		headers: {
			accept: "application/vnd.github.v3+json",
			"user-agent": "octokit.js/16.43.2 Node.js/14.17.6 (Linux 5.10; x64)",
			authorization: "token [REDACTED]"
		},
		request: {
			hook: "",
			validate: {},
			retries: 6,
			retryAfter: 10,
			retryCount: 6
		}
	},
	documentation_url:
		"https://docs.github.com/rest/reference/pulls#list-pull-requests"
};

export const mockOtherOctokitGraphqlErrors = {
	data: {
		repository: null
	},
	errors: [
		{
			type: "SOME_OTHER_ERROR",
			path: ["repository"],
			locations: [
				{
					line: 7,
					column: 3
				}
			],
			message:
				"Could not resolve to a Repository with the name 'some-org/some-repo'."
		}
	]
};

export const mockOtherError = "This is a completely different error.";

export const mockJob = {
	opts: {
		attempts: 5,
		timeout: 600000,
		backoff: { type: "exponential", delay: 180000 },
		removeOnComplete: true,
		removeOnFail: true,
		delay: 0,
		timestamp: 1632709075593
	},
	name: "__default__",
	queue: {
		defaultJobOptions: {
			attempts: 5,
			timeout: 600000,
			backoff: [Object],
			removeOnComplete: true,
			removeOnFail: true
		},
		name: "Initial sync",
		token: "fake-token",
		keyPrefix: "bull",
		clients: [],
		clientInitialized: true,
		_events: {
			close: [],
			error: [],
			active: [],
			completed: [],
			failed: []
		},
		_eventsCount: 5,
		_initializing: {},
		handlers: { __default__: [] },
		processing: [],
		retrieving: 0,
		drained: false,
		settings: {
			lockDuration: 600500,
			stalledInterval: 30000,
			maxStalledCount: 1,
			guardInterval: 5000,
			retryProcessDelay: 5000,
			drainDelay: 5,
			backoffStrategies: {},
			lockRenewTime: 300250
		},
		timers: { idle: false, listeners: [], timers: [Object] },
		moveUnlockedJobsToWait: [],
		processJob: [],
		getJobFromId: [],
		keys: {
			"": "bull:Initial sync:",
			active: "bull:Initial sync:active",
			wait: "bull:Initial sync:wait",
			waiting: "bull:Initial sync:waiting",
			paused: "bull:Initial sync:paused",
			resumed: "bull:Initial sync:resumed",
			"meta-paused": "bull:Initial sync:meta-paused",
			id: "bull:Initial sync:id",
			delayed: "bull:Initial sync:delayed",
			priority: "bull:Initial sync:priority",
			"stalled-check": "bull:Initial sync:stalled-check",
			completed: "bull:Initial sync:completed",
			failed: "bull:Initial sync:failed",
			stalled: "bull:Initial sync:stalled",
			repeat: "bull:Initial sync:repeat",
			limiter: "bull:Initial sync:limiter",
			drained: "bull:Initial sync:drained",
			progress: "bull:Initial sync:progress"
		},
		delayedTimestamp: 1632709257890.0984,
		_initializingProcess: {},
		errorRetryTimer: {},
		subscriberInitialized: true,
		registeredEvents: { delayed: [] },
		bclientInitialized: true
	},
	data: {
		installationId: 19700682,
		jiraHost: "https://somehost.atlassian.net",
		startTime: "2021-09-27T02:17:54.039Z"
	},
	_progress: 0,
	delay: 0,
	timestamp: 1632709075593,
	stacktrace: [],
	returnvalue: null,
	attemptsMade: 0,
	toKey: [],
	id: "405",
	processedOn: 1632709075594,
	failedReason: undefined,
	sentry: { _version: 4, _stack: [] }
};

export const mockNextTask:Task = {
	task: "branch",
	taskStartTimeInMS: 1672531200000,
	repositoryId: 483702170,
	repository: {
		id: 483702170,
		name: "some-repo",
		full_name: "Some-Org/some-repo",
		owner: { login: "Some-Org" },
		html_url: "https://github.com/some-org/some-repo",
		updated_at: "23132123"
	},
	cursor: 1
};
