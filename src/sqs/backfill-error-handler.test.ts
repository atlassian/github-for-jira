import { BackfillMessagePayload, SQSMessageContext } from "~/src/sqs/sqs.types";
import { getLogger } from "config/logger";
import { backfillErrorHandler } from "~/src/sqs/backfill-error-handler";
import { Sequelize } from "sequelize";
import { TaskError } from "~/src/sync/installation";
import { Repository, Subscription } from "models/subscription";
import { Task } from "~/src/sync/sync.types";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import _ from "lodash";
import { RepoSyncState } from "models/reposyncstate";
import {
	GithubClientError,
	GithubClientInvalidPermissionsError, GithubClientNotFoundError, GithubClientRateLimitingError
} from "~/src/github/client/github-client-errors";
import { AxiosError } from "axios";
import { createAnonymousClient } from "utils/get-github-client-config";
import { JiraClientError } from "~/src/jira/client/axios";
import { JiraClient } from "models/jira-client";
import { Installation } from "models/installation";

const TEST_REPO: Repository = {
	id: 123,
	name: "Test",
	full_name: "Test/Test",
	owner: { login: "test" },
	html_url: "https://test",
	updated_at: "1234"
};

describe("backfillErrorHandler", () => {
	const MOCKED_TIMESTAMP_MSECS = 12_345_678;

	let installation: Installation | null;
	let subscription: Subscription | null;
	let repoSyncState: RepoSyncState;
	let task: Task;
	let sendMessageMock: jest.Mock;

	beforeEach(async () => {
		mockSystemTime(MOCKED_TIMESTAMP_MSECS);

		const ret = await new DatabaseStateCreator().withActiveRepoSyncState().create();
		installation = ret.installation;
		subscription = ret.subscription;
		repoSyncState = ret.repoSyncState!;

		task = { task: "commit", repositoryId: repoSyncState.repoId, repository: _.cloneDeep(TEST_REPO) };
		sendMessageMock = jest.fn();
	});

	const createRateLimitingError = async (resetTime: number): Promise<GithubClientRateLimitingError | undefined> => {
		gheNock.get("/")
			.reply(403, {}, {
				"access-control-allow-origin": "*",
				"connection": "close",
				"content-type": "application/json; charset=utf-8",
				"date": "Fri, 04 Mar 2022 21:09:27 GMT",
				"x-ratelimit-limit": "8900",
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": "" + resetTime.toString(),
				"x-ratelimit-resource": "core",
				"x-ratelimit-used": "2421"
			});

		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			return err as GithubClientRateLimitingError;
		}
		return undefined;
	};

	const create500FromGitHub = async (): Promise<GithubClientError | undefined> => {
		gheNock.get("/")
			.reply(500);

		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			return err as GithubClientError;
		}
		return undefined;
	};

	const create500FromJira = async (): Promise<JiraClientError | undefined> => {
		const client = installation && await JiraClient.getNewClient(installation, getLogger("test"));

		jiraNock.get(/.*/).reply(500, { });

		try {
			await client?.appPropertiesGet();
		} catch (ex: unknown) {
			return ex as JiraClientError;
		}
		return undefined;
	};

	const createContext = (receiveCount: number, lastAttempt: boolean): SQSMessageContext<BackfillMessagePayload> =>
		({
			receiveCount, lastAttempt, log: getLogger("test"), message: {}, payload: {
				jiraHost,
				installationId: subscription?.gitHubInstallationId || 0
			}
		});

	it("retries unknown errors with exponential timeout", async () => {
		const abuseDetectionError = {
			...new Error(),
			documentation_url: "https://docs.github.com/rest/reference/pulls#list-pull-requests",
			headers: {
				"access-control-allow-origin": "*",
				"connection": "close",
				"content-type": "application/json; charset=utf-8",
				"date": "Fri, 04 Mar 2022 21:09:27 GMT",
				"x-ratelimit-limit": "8900",
				"x-ratelimit-remaining": "6479",
				"x-ratelimit-reset": "12360",
				"x-ratelimit-resource": "core",
				"x-ratelimit-used": "2421"
			},
			message: "You have triggered an abuse detection mechanism",
			name: "HttpError",
			status: 403
		};
		const result = await backfillErrorHandler(jest.fn())(abuseDetectionError, createContext(2, false));
		expect(result).toMatchObject({
			isFailure: true,
			retryDelaySec: 540,
			retryable: true
		});

	});

	it("retries unknown TaskError with exponential timeout", async () => {
		let sequelizeConnectionError!: Error;
		try {
			const sequelize = new Sequelize({
				dialect: "postgres",
				host: "1.2.3.400",
				port: 3306,
				username: "your_username",
				password: "your_password",
				database: "your_database"
			});
			await sequelize.authenticate();
		} catch (err: unknown) {
			sequelizeConnectionError = err as Error;
		}

		const result = await backfillErrorHandler(jest.fn())(new TaskError(task, sequelizeConnectionError), createContext(2, false));
		expect(result).toMatchObject({
			isFailure: true,
			retryDelaySec: 540,
			retryable: true
		});
	});

	it("retries 500s from GitHub with exponential timeout", async () => {
		const result = await backfillErrorHandler(jest.fn())(
			new TaskError(task, (await create500FromGitHub())!),
			createContext(2, false)
		);
		expect(result).toMatchObject({
			isFailure: true,
			retryDelaySec: 540,
			retryable: true
		});
	});

	it("retries 500s from Jira with exponential timeout", async () => {
		const result = await backfillErrorHandler(jest.fn())(
			new TaskError(task, (await create500FromJira())!),
			createContext(2, false)
		);
		expect(result).toMatchObject({
			isFailure: true,
			retryDelaySec: 540,
			retryable: true
		});
	});

	it("marks task as failed and reschedules message on last attempt", async () => {
		const result = await backfillErrorHandler(sendMessageMock)(
			new TaskError(task, new Error("boom")),
			createContext(5, true)
		);

		expect(result).toMatchObject({
			isFailure: false
		});
		const mockMessage = sendMessageMock.mock.calls[0] as any[];
		expect(mockMessage[0]).toEqual(
			{ installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost }
		);
		expect(mockMessage[1]).toEqual(0);
		expect((await RepoSyncState.findByPk(repoSyncState!.id))?.commitStatus).toEqual("failed");
	});

	it("marks task as failed and reschedules message on permission error", async () => {
		const result = await backfillErrorHandler(sendMessageMock)(
			new TaskError(task, new GithubClientInvalidPermissionsError({ } as unknown as AxiosError)),
			createContext(5, true)
		);

		expect(result).toMatchObject({
			isFailure: false
		});
		const mockMessage = sendMessageMock.mock.calls[0] as any[];
		expect(mockMessage[0]).toEqual(
			{ installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost }
		);
		expect(mockMessage[1]).toEqual(0);
		expect((await RepoSyncState.findByPk(repoSyncState!.id))?.commitStatus).toEqual("failed");
		expect((await Subscription.findByPk(repoSyncState!.subscriptionId))?.syncWarning).toEqual("Invalid permissions for commit task");
	});

	it("reschedules rate-limited errors with the correct delay", async () => {
		const RATE_LIMIT_RESET_TIMESTAMP_SECS = 12360;

		const context = createContext(3, false);
		const result =  await backfillErrorHandler(sendMessageMock)(
			new TaskError(
				task,
				(await createRateLimitingError(RATE_LIMIT_RESET_TIMESTAMP_SECS))!
			),
			context
		);

		expect(sendMessageMock).toBeCalledWith(context.payload, (RATE_LIMIT_RESET_TIMESTAMP_SECS * 1000 - MOCKED_TIMESTAMP_MSECS) / 1000, expect.anything());
		expect(result.isFailure).toBeFalsy();
	});

	it("reschedules rate-limited errors with the correct delay when header points to the past", async () => {
		const RATE_LIMIT_RESET_TIMESTAMP_SECS = 12;

		const context = createContext(3, false);
		const result =  await backfillErrorHandler(sendMessageMock)(
			new TaskError(
				task,
				(await createRateLimitingError(RATE_LIMIT_RESET_TIMESTAMP_SECS))!
			),
			context
		);

		expect(sendMessageMock).toBeCalledWith(context.payload, 0, expect.anything());
		expect(result.isFailure).toBeFalsy();
	});

	it("not found error marks the task as done and continues", async () => {
		const result = await backfillErrorHandler(sendMessageMock)(
			new TaskError(task, new GithubClientNotFoundError({ } as unknown as AxiosError)),
			createContext(3, false)
		);

		expect(result).toMatchObject({
			isFailure: false
		});
		const mockMessage = sendMessageMock.mock.calls[0] as any[];
		expect(mockMessage[0]).toEqual(
			{ installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost }
		);
		expect(mockMessage[1]).toEqual(0);
		expect((await RepoSyncState.findByPk(repoSyncState!.id))?.commitStatus).toEqual("complete");
	});
});
