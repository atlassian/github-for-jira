import { startMonitorOnMaster, startMonitorOnWorker } from "utils/workers-health-monitor";
import { stopHealthcheck } from "utils/healthcheck-stopper";
import cluster from "cluster";
import { GenerateOnceCoredumpGenerator } from "services/generate-once-coredump-generator";
import fs from "fs";
import AWS from "aws-sdk";
import { waitUntil } from "test/utils/wait-until";
jest.mock("cluster", () => {
	const workers = {
		1: { send: jest.fn(), on: jest.fn(), process: { pid: 1 } },
		2: { send: jest.fn(), on: jest.fn(), process: { pid: 2 } }
	};
	return {
		workers
	};
});

jest.mock("utils/healthcheck-stopper");
jest.mock("services/generate-once-coredump-generator");
jest.mock("aws-sdk");

describe("workers-health-monitor", () => {
	let originalProcessSend;
	let originalProcessOn;
	let maybeGenerateCoredump: jest.Mock;
	const intervals: NodeJS.Timeout[] = [];
	beforeEach(() => {
		jest.useFakeTimers("modern").setSystemTime(new Date("2020-01-01"));

		originalProcessSend = process.send;
		originalProcessOn = process.on;
		process.send = jest.fn();
		process.on = jest.fn();
		maybeGenerateCoredump = jest.fn();
		(GenerateOnceCoredumpGenerator as jest.Mock).mockReturnValue({
			maybeGenerateCoredump: maybeGenerateCoredump
		});
		logger.child = jest.fn(() => logger);
	});

	afterEach(() => {
		process.send = originalProcessSend;
		process.on = originalProcessOn;
		intervals.forEach(clearInterval);
		jest.resetAllMocks();
	});

	const logger = {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		child: jest.fn(() => logger)
	};

	describe("startMonitorOnWorker", () => {

		it("should start the worker monitoring", async () => {
			intervals.push(...startMonitorOnWorker(logger, {
				iAmAliveInervalMsec: 10,
				coredumpIntervalMsec: 1000,
				lowHeapAvailPct: 10
			}));

			jest.advanceTimersByTime(11);
			expect(process.send).toHaveBeenCalledWith(`${process.pid}`);
		});

		it("should stop healthchecks when shutdown is received", async () => {
			intervals.push(...startMonitorOnWorker(logger, {
				iAmAliveInervalMsec: 10,
				coredumpIntervalMsec: 1000,
				lowHeapAvailPct: 10
			}));
			(process.on as jest.Mock).mock.calls[0][1]("shutdown");

			expect(stopHealthcheck).toBeCalled();
		});

		it("should generate heapdump only once", async () => {
			intervals.push(...startMonitorOnWorker(logger, {
				iAmAliveInervalMsec: 1000,
				coredumpIntervalMsec: 10,
				lowHeapAvailPct: 10
			}));

			jest.advanceTimersByTime(25);
			expect(GenerateOnceCoredumpGenerator).toBeCalledTimes(1);
			expect(GenerateOnceCoredumpGenerator).toBeCalledWith({
				logger: expect.anything(),
				lowHeapAvailPct: 10
			});
			expect(maybeGenerateCoredump).toBeCalledTimes(2);
		});
	});

	describe("startMonitorOnMaster",  () => {
		it("should start listening signals from workers", async () => {
			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 1,
				workerUnresponsiveThresholdMsecs: 10000,
				numberOfWorkersThreshold: 2
			}));

			jest.advanceTimersByTime(20);

			expect(cluster.workers[1]!.on).toBeCalled();
			expect(cluster.workers[2]!.on).toBeCalled();
		});

		it("should not stop healthchecks when workers emit IAmAlive signals", async () => {
			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 20,
				workerUnresponsiveThresholdMsecs: 40,
				numberOfWorkersThreshold: 1
			}));

			const workerSendingImAliveToMasterInterval = setInterval(() => {
				if ((cluster.workers[1]!.on as jest.Mock).mock.calls.length > 0) {
					(cluster.workers[1]!.on as jest.Mock).mock.calls[0][1]();
					(cluster.workers[2]!.on as jest.Mock).mock.calls[0][1]();
				}
			}, 9);

			try {
				jest.advanceTimersByTime(50);

				expect(cluster.workers[1]!.send).not.toBeCalled();
				expect(cluster.workers[2]!.send).not.toBeCalled();

			} finally {
				clearInterval(workerSendingImAliveToMasterInterval);
			}
		});

		it("should stop healthchecks when workers do not emit IAmAlive signals", async () => {
			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 20,
				workerUnresponsiveThresholdMsecs: 40,
				numberOfWorkersThreshold: 1
			}));

			jest.advanceTimersByTime(50);

			expect(cluster.workers[1]!.send).toBeCalled();
			expect(cluster.workers[2]!.send).toBeCalled();
		});

		const CORE_READY_FILEPATH = "/tmp/core.123.ready";
		const CORE_UPLOAD_INPGORESS_FILEPATH = "/tmp/core.123.ready.uploadinprogress";

		const deleteFileSafe = (path: string) => {
			try {
				fs.unlinkSync(path);
				// eslint-disable-next-line no-empty
			} catch (err) {

			}
		};

		beforeEach(() => {
			deleteFileSafe(CORE_READY_FILEPATH);
			deleteFileSafe(CORE_UPLOAD_INPGORESS_FILEPATH);
		});

		afterEach(() => {
			deleteFileSafe(CORE_READY_FILEPATH);
			deleteFileSafe(CORE_UPLOAD_INPGORESS_FILEPATH);
		});

		it("should upload coredumps to S3", async () => {
			fs.writeFileSync("/tmp/core.123.ready", "test-string");

			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 20,
				workerUnresponsiveThresholdMsecs: 40,
				numberOfWorkersThreshold: 1
			}));

			const uploadFn = jest.fn();
			(AWS.S3 as unknown as jest.Mock).mockReturnValue({
				upload: uploadFn
			});

			jest.advanceTimersByTime(15);

			intervals.forEach(clearInterval); // otherwise waitUntil won't work, let's stop execution once upload is invoked
			jest.useRealTimers();

			await waitUntil(async () => {
				const exists = fs.existsSync(CORE_UPLOAD_INPGORESS_FILEPATH);
				expect(exists).toBeTruthy();
				expect(uploadFn).toBeCalled();
			});

			expect(uploadFn).toBeCalledWith({
				Body: expect.anything(),
				Bucket: "my-bucket",
				Key: "my/path/core.123.ready_2020-01-01T00_00_00_010Z",
				Region: "my-region"
			}, expect.anything());

			uploadFn.mock.calls[0][1]();
			expect(fs.existsSync(CORE_UPLOAD_INPGORESS_FILEPATH)).toBeFalsy();
		});
	});
});
