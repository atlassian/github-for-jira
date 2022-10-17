import { emitWebhookPayloadMetrics, emitWebhookProcessedMetrics } from "./webhook-utils";
import { statsd }  from "config/statsd";

describe("Webhooks suite", () => {
	const mockInfoLog = jest.fn();
	const mockErrorLog = jest.fn();
	const mockContextLogger = {
		info: mockInfoLog,
		error: mockErrorLog,
		warn: jest.fn(),
		debug: jest.fn()
	} as any;

	const currentTime = 2000;

	beforeEach(() => {
		mockSystemTime(currentTime);
	});

	describe("emitWebhookProcessingTimeMetrics", () => {
		it("should calculate processing time for webhook events", () => {
			const webhookReceived = 500;
			const webhookName = "workflow_run";
			const status = 202;
			const result = currentTime - webhookReceived;
			const addStatsdSpy = jest.spyOn(statsd, "histogram");

			expect(
				emitWebhookProcessedMetrics(
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
					gitHubProduct: "cloud"
				}
			);

			expect(addStatsdSpy).toHaveBeenCalledWith(
				"app.server.webhooks.processing-time.latency",
				1500,
				{
					gsd_histogram: "1000_10000_30000_60000_120000_300000_600000_3000000",
					name: "workflow_run",
					status: "202",
					gitHubProduct: "cloud"
				}
			);
		});

		describe("should return undefined", () => {
			it("if webhookReceived time is later than the current time", () => {
				const webhookReceived = 2500;
				const webhookName = "workflow_run";
				const status = 400;

				expect(
					emitWebhookProcessedMetrics(
						webhookReceived,
						webhookName,
						mockContextLogger,
						status
					)
				).toEqual(undefined);
			});

			it("if webhookReceived is undefined", () => {
				expect(
					emitWebhookProcessedMetrics(
						undefined as any,
						"workflow_run",
						mockContextLogger,
						undefined
					)
				).toEqual(undefined);
			});

			it("if webhookReceived is null", () => {
				expect(
					emitWebhookProcessedMetrics(
						null as any,
						"workflow_run",
						mockContextLogger,
						undefined
					)
				).toEqual(undefined);
			});
		});
	});

	describe("emitWebhookPayloadMetrics", () => {
		it("should push metrics for payload size", () => {
			const statsdSpy = jest.spyOn(statsd, "histogram");
			const webhookName = "workflow_run";
			const payloadSize = 0;
			emitWebhookPayloadMetrics(webhookName, payloadSize);
			expect(statsdSpy).toHaveBeenCalledTimes(2);
		});
	});
});
