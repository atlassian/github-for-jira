import Logger from "bunyan";
import { logInfoSampled } from "utils/log-sampled";
describe("log-sampled", () => {
	it("logSampledInfo should log during the very first call", () => {
		const logger = {
			info: jest.fn()
		} as unknown as Logger;
		logInfoSampled(logger, "foo", "hello", 10);
		expect(logger.info).toBeCalledWith({ sampled: true }, "hello (sampled)");
	});

	it("logSampledInfo should log sampled messages", () => {
		const logger = {
			info: jest.fn()
		} as unknown as Logger;
		for (let callNo = 0; callNo < 100; callNo++) {
			logInfoSampled(logger, "foo", "hello", 10);
		}
		expect(logger.info).toBeCalledTimes(10);
	});
});
