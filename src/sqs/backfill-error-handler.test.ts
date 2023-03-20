import { BackfillMessagePayload, SQSMessageContext } from "~/src/sqs/sqs.types";
import { getLogger } from "config/logger";
import { backfillErrorHandler } from "~/src/sqs/backfill-error-handler";
import { SqsQueue } from "~/src/sqs/sqs";
import { Sequelize } from "sequelize";
import { TaskError } from "~/src/sync/installation";
import { Repository } from "models/subscription";
import { Task } from "~/src/sync/sync.types";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import _ from "lodash";
import { RepoSyncState } from "models/reposyncstate";

describe("backfillErrorHandler", () => {
	const mockPayload = {
		repository: {
			id: 0,
			name: "string",
			full_name: "string",
			html_url: "string",
			owner: "string"
		},
		shas: [],
		jiraHost: "string",
		installationId: 0,
		webhookId: "string"
	};

	const TEST_REPO: Repository = {
		id: 123,
		name: "Test",
		full_name: "Test/Test",
		owner: { login: "test" },
		html_url: "https://test",
		updated_at: "1234"
	};

	const TASK: Task = { task: "commit", repositoryId: 123, repository: TEST_REPO };

	const createContext = (receiveCount: number, lastAttempt: boolean): SQSMessageContext<BackfillMessagePayload> =>
		({
			receiveCount, lastAttempt, log: getLogger("test"), message: {}, payload: mockPayload
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
		const result = await backfillErrorHandler({ queue: jest.fn() as unknown as SqsQueue<any> })(abuseDetectionError, createContext(2, false));
		expect(result).toEqual({
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
		} catch (err) {
			sequelizeConnectionError = err;
		}

		const result = await backfillErrorHandler({ queue: jest.fn() as unknown as SqsQueue<any> })(new TaskError(TASK, sequelizeConnectionError), createContext(2, false));
		expect(result).toEqual({
			isFailure: true,
			retryDelaySec: 540,
			retryable: true
		});
	});

	it("marks task as failed and reschedules message on last attempt", async () => {
		const { subscription, repoSyncState } = await new DatabaseStateCreator().withActiveRepoSyncState().create();

		const context = createContext(5, true);
		context.payload = {
			jiraHost,
			installationId: subscription.gitHubInstallationId
		};

		const task = _.cloneDeep(TASK);
		task.repositoryId = repoSyncState?.repoId || -1;

		const sendMessageMock = jest.fn();
		const result = await backfillErrorHandler(
			{ queue: { sendMessage: sendMessageMock } as unknown as SqsQueue<any> }
		)(new TaskError(task, new Error("boom")), context);

		expect(result).toEqual({
			isFailure: false
		});
		expect(sendMessageMock.mock.calls[0]).toEqual([
			{ installationId: DatabaseStateCreator.GITHUB_INSTALLATION_ID, jiraHost }, 0
		]);
		expect((await RepoSyncState.findByPk(repoSyncState!.id)).commitStatus).toEqual("failed");
	});
});
