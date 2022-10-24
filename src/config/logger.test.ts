import { getLogger } from "config/logger";
import { RingBuffer, Stream } from "bunyan";

describe("logger behaviour", () => {

	describe("safe logger", () => {
		let ringBuffer: RingBuffer;

		beforeEach(() => {
			ringBuffer = new RingBuffer({ limit: 5 });
		});

		it("should write out logging action text to msg stream", () => {
			const logger = getLogger("name");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.info("Greetings");

			expect(JSON.parse(ringBuffer.records[0]).msg).toEqual("Greetings");
		});

		it("should keep parent fields on new child logger", () => {
			const logger = getLogger("name", { fields: { foo: "bar" } });
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

		it("Should remove branch from URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				config: {
					url: "/rest/devinfo/0.10/repository/448757705/branch/bugfix-installed-script?_updateSequenceId=1663617601470"
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).config.url).toEqual("/rest/devinfo/0.10/repository/448757705/branch/CENSORED");
		});
	});

	describe("logger circular dependencies", () => {
		const logger = getLogger("circular-logger");
		it("should not throw when a circular dependency is passed to logger", () => {
			const data = {
				a: { foo: true },
				b: { bar: "string" }
			};
			data.a = data as any;
			expect(() => logger.warn(data, "log")).not.toThrow();
		});
	});

});
