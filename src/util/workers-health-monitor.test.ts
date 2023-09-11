import { startMonitorOnMaster, startMonitorOnWorker } from "utils/workers-health-monitor";
import { waitUntil } from "test/utils/wait-until";
import { stopHealthcheck } from "utils/healthcheck-stopper";
import cluster from "cluster";
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

const sleep = async (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
describe("workers-health-monitor", () => {
	let originalProcessSend;
	let originalProcessOn;
	const intervals: NodeJS.Timeout[] = [];
	beforeEach(() => {
		originalProcessSend = process.send;
		originalProcessOn = process.on;
		process.send = jest.fn();
		process.on = jest.fn();
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
			intervals.push(startMonitorOnWorker(logger, 10));

			await waitUntil(async () => {
				expect(process.send).toHaveBeenCalledWith(`${process.pid}`);
			});
		});

		it("should stop healthchecks when shutdown is received", async () => {
			intervals.push(startMonitorOnWorker(logger, 10));
			(process.on as jest.Mock).mock.calls[0][1]("shutdown");

			expect(stopHealthcheck).toBeCalled();
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

			await waitUntil(async () => {
				expect(cluster.workers[1]!.on).toBeCalled();
				expect(cluster.workers[2]!.on).toBeCalled();
			});
		});

		it("should not stop healthchecks when workers emit IAmAlive signals", async () => {
			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 200,
				workerUnresponsiveThresholdMsecs: 400,
				numberOfWorkersThreshold: 1
			}));

			const interval = setInterval(() => {
				if ((cluster.workers[1]!.on as jest.Mock).mock.calls.length > 0) {
					(cluster.workers[1]!.on as jest.Mock).mock.calls[0][1]();
					(cluster.workers[2]!.on as jest.Mock).mock.calls[0][1]();
				}
			}, 100);

			try {
				await sleep(800);

				expect(cluster.workers[1]!.send).not.toBeCalled();
				expect(cluster.workers[2]!.send).not.toBeCalled();
			} finally {
				clearInterval(interval);
			}
		});

		it("should stop healthchecks when workers do not emit IAmAlive signals", async () => {
			intervals.push(startMonitorOnMaster(logger, {
				pollIntervalMsecs: 10,
				workerStartupTimeMsecs: 1,
				workerUnresponsiveThresholdMsecs: 100,
				numberOfWorkersThreshold: 1
			}));

			await waitUntil(async () => {
				expect(cluster.workers[1]!.send).toBeCalled();
				expect(cluster.workers[2]!.send).toBeCalled();
			});
		});
	});
});
