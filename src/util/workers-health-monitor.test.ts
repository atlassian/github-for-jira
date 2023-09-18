import { startMonitorOnMaster, startMonitorOnWorker } from "utils/workers-health-monitor";
import { stopHealthcheck } from "utils/healthcheck-stopper";
import cluster from "cluster";
import { GenerateOnceCoredumpGenerator } from "services/generate-once-coredump-generator";
import { GenerateOncePerNodeHeadumpGenerator } from "services/generate-once-per-node-headump-generator";
import fs from "fs";
import AWS from "aws-sdk";
import { waitUntil } from "test/utils/wait-until";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
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
jest.mock("services/generate-once-per-node-headump-generator");
jest.mock("aws-sdk");
jest.mock("config/feature-flags");

describe("workers-health-monitor", () => {
	let originalProcessSend;
	let originalProcessOn;
	let maybeGenerateCoredump: jest.Mock;
	let maybeGenerateHeapdump: jest.Mock;
	const intervals: NodeJS.Timeout[] = [];
	beforeEach(() => {
		jest.useFakeTimers("modern").setSystemTime(new Date("2020-01-01"));

		originalProcessSend = process.send;
		originalProcessOn = process.on;
		process.send = jest.fn();
		process.on = jest.fn();
		maybeGenerateCoredump = jest.fn();
		maybeGenerateHeapdump = jest.fn();
		(GenerateOnceCoredumpGenerator as jest.Mock).mockReturnValue({
			maybeGenerateDump: maybeGenerateCoredump
		});
		(GenerateOncePerNodeHeadumpGenerator as jest.Mock).mockReturnValue({
			maybeGenerateDump: maybeGenerateHeapdump
		});
		logger.child = jest.fn(() => logger);

		when(booleanFlag).calledWith(BooleanFlags.GENERATE_CORE_HEAP_DUMPS_ON_LOW_MEM).mockResolvedValue(true);
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
				dumpIntervalMsec: 1000,
				lowHeapAvailPct: 10
			}));

			jest.advanceTimersByTime(11);
			expect(process.send).toHaveBeenCalledWith(`${process.pid}`);
		});

		it("should stop healthchecks when shutdown is received", async () => {
			intervals.push(...startMonitorOnWorker(logger, {
				iAmAliveInervalMsec: 10,
				dumpIntervalMsec: 1000,
				lowHeapAvailPct: 10
			}));
			(process.on as jest.Mock).mock.calls[0][1]("shutdown");

			expect(stopHealthcheck).toBeCalled();
		});

		it("should generate core and heap dumps", async () => {
			intervals.push(...startMonitorOnWorker(logger, {
				iAmAliveInervalMsec: 1000,
				dumpIntervalMsec: 10,
				lowHeapAvailPct: 10
			}));

			jest.advanceTimersByTime(25);
			expect(GenerateOnceCoredumpGenerator).toBeCalledTimes(1);
			expect(GenerateOnceCoredumpGenerator).toBeCalledWith({
				logger: expect.anything(),
				lowHeapAvailPct: 10
			});
			expect(maybeGenerateCoredump).toBeCalledTimes(2);
			expect(GenerateOncePerNodeHeadumpGenerator).toBeCalledTimes(1);
			expect(GenerateOncePerNodeHeadumpGenerator).toBeCalledWith({
				logger: expect.anything(),
				lowHeapAvailPct: 10
			});
			expect(maybeGenerateHeapdump).toBeCalledTimes(2);
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

		const DUMP_READY_FILEPATH = "/tmp/dump_core.123.ready";
		const DUMP_UPLOAD_FILEPATH = "/tmp/dump_core.123.ready.uploadinprogress";

		const deleteFileSafe = (path: string) => {
			try {
				fs.unlinkSync(path);
				// eslint-disable-next-line no-empty
			} catch (err) {

			}
		};

		beforeEach(() => {
			deleteFileSafe(DUMP_READY_FILEPATH);
			deleteFileSafe(DUMP_UPLOAD_FILEPATH);
		});

		afterEach(() => {
			deleteFileSafe(DUMP_READY_FILEPATH);
			deleteFileSafe(DUMP_UPLOAD_FILEPATH);
		});

		it("should upload dumps to S3", async () => {
			fs.writeFileSync(DUMP_READY_FILEPATH, "test-string");

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
				const exists = fs.existsSync(DUMP_UPLOAD_FILEPATH);
				expect(exists).toBeTruthy();
				expect(uploadFn).toBeCalled();
			});

			expect(uploadFn).toBeCalledWith({
				Body: expect.anything(),
				Bucket: "my-bucket",
				Key: "my/path/dump_core.123.ready_2020-01-01T00_00_00_010Z",
				Region: "my-region"
			}, expect.anything());

			uploadFn.mock.calls[0][1]();
			expect(fs.existsSync(DUMP_UPLOAD_FILEPATH)).toBeFalsy();
		});
	});
});
