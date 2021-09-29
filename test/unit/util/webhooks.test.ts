import { emitWebhookProcessingTimeMetrics } from "../../../src/util/webhooks";
import statsd from "../../../src/config/statsd";

let dateNowSpy;

const currentTime = 2000;

beforeAll(() => {
	// Lock Time
	dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => currentTime);
});

afterAll(() => {
	// Unlock Time
	dateNowSpy.mockRestore();
});

describe("Webhooks suite", () => {
	const mockInfoLog = jest.fn();
	const mockErrorLog = jest.fn();
	const mockContextLogger = {
		info: mockInfoLog,
		error: mockErrorLog,
	};

	describe("emitWebhookProcessingTimeMetrics", () => {
		it("should calculate processing time for webhook events", () => {
			const webhookReceived = 500;
			const webhookName = "workflow_run";
			const status = 202;
			const result = currentTime - webhookReceived;
			const addStatsdSpy = jest.spyOn(statsd, "histogram");

			expect(
				emitWebhookProcessingTimeMetrics(
					webhookReceived,
					webhookName,
					mockContextLogger,
					status
				)
			).toEqual(result);

			// one call to send webhookProcessingTimes, one call to send webhookLatency
			expect(addStatsdSpy).toHaveBeenCalledTimes(2);
			expect(addStatsdSpy).toHaveBeenCalledWith(
				"app.server.webhooks.processing-time.duration-ms",
				1500,
				{
					gsd_histogram: "1000_10000_30000_60000_120000_300000_600000_3000000",
					name: "workflow_run",
					status: "202",
				}
			);

			expect(addStatsdSpy).toHaveBeenCalledWith(
				"app.server.webhooks.processing-time.latency",
				1500,
				{
					gsd_histogram: "1000_10000_30000_60000_120000_300000_600000_3000000",
					name: "workflow_run",
					status: "202",
				}
			);
		});

		describe("should return undefined", () => {
			it("if webhookReceived time is later than the current time", () => {
				const webhookReceived = 2500;
				const webhookName = "workflow_run";
				const status = 400;

				expect(
					emitWebhookProcessingTimeMetrics(
						webhookReceived,
						webhookName,
						mockContextLogger,
						status
					)
				).toEqual(undefined);
			});

			it("if webhookReceived is undefined", () => {
				const webhookReceived = undefined;
				const webhookName = "workflow_run";
				const status = null;

				expect(
					emitWebhookProcessingTimeMetrics(
						webhookReceived,
						webhookName,
						mockContextLogger,
						status
					)
				).toEqual(undefined);
			});

			it("if webhookReceived is null", () => {
				const webhookReceived = undefined;
				const webhookName = "workflow_run";
				const status = undefined;

				expect(
					emitWebhookProcessingTimeMetrics(
						webhookReceived,
						webhookName,
						mockContextLogger,
						status
					)
				).toEqual(undefined);
			});
		});
	});
});
