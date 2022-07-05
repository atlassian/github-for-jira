import { getLogger, getUnsafeLogger } from "config/logger";
import { Stream, RingBuffer } from "bunyan";

describe("logger behaviour", () => {

	describe("safe logger", () => {
		let ringBuffer: RingBuffer;

		beforeEach(() => {
			ringBuffer = new RingBuffer({ limit: 5 });
		});

		it("should serialize sensitive data as part of getlogger", () => {
			const logger = getLogger("name", { jiraHost: "CATS" });
			expect(logger.fields.jiraHost).toBe("8fc7392715b5a41d57eae37981e736cdca9165861b9ad0a79b4114a0b2e889e2");
		});

		it("should serialize sensitive data as part of logging action", () => {
			const logger = getLogger("name", { orgName: "CATS" });
			logger.addStream({ stream: ringBuffer as Stream });
			logger.info({ jiraHost: "CATS" },"Good day");

			expect(JSON.parse(ringBuffer.records[0]).jiraHost).toEqual("8fc7392715b5a41d57eae37981e736cdca9165861b9ad0a79b4114a0b2e889e2");
		});

		it("should write out logging action text to msg stream", () => {
			const logger = getLogger("name");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.info("Greetings");

			expect(JSON.parse(ringBuffer.records[0]).msg).toEqual("Greetings");
		});

		it("should keep parent fields on new child logger", () => {
			const logger = getLogger("name", { foo: "bar" });
			const childLogger = logger.child({ bingo: "buzz" });
			logger.warn("Greetings");

			expect(childLogger.fields.foo).toBe("bar");
			expect(childLogger.fields.bingo).toBe("buzz");
		});

		it("Should write all logging methods to msg stream", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.warn("Warning");
			logger.info("Info");
			logger.error("Error");
			logger.fatal("FATALALITY");

			expect(JSON.parse(ringBuffer.records[0]).msg).toEqual("Warning");
			expect(JSON.parse(ringBuffer.records[1]).msg).toEqual("Info");
			expect(JSON.parse(ringBuffer.records[2]).msg).toEqual("Error");
			expect(JSON.parse(ringBuffer.records[3]).msg).toEqual("FATALALITY");
		});
	});

	describe("unsafe logger", () => {
		it("should not serialize sensitive data", () => {
			const logger = getUnsafeLogger("name", { jiraHost: "CATS" });
			expect(logger.fields.jiraHost).toBe("CATS");
		});
	});

});
