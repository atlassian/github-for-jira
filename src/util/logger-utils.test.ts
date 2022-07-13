import { filterHttpRequests, RawLogStream } from "./logger-utils";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("Logger Utils", () => {

	describe("filterHttpRequests", () => {

		it("should return false for msg with http request keyword and not targeted logger", () => {
			const record = {
				msg: "GET - Im a filterable msg",
				name: "NO-FILTEREDNAME"
			};
			expect(filterHttpRequests(record, "FILTEREDNAME")).toEqual(false);
		});

		it("should return true for msg with http request keyword and targeted logger", () => {
			const record = {
				msg: "GET - ima get filtered",
				name: "FILTEREDNAME"
			};
			expect(filterHttpRequests(record, "FILTEREDNAME")).toEqual(true);
		});

		it("should return false for msg without http request keyword and targeted logger", () => {
			const record = {
				msg: "STUFF - Im a legit message",
				name: "FILTEREDNAME"
			};
			expect(filterHttpRequests(record, "FILTEREDNAME")).toEqual(false);
		});

		it("should return false for msg with http request keyword and targeted logger", () => {
			const record = {
				msg: "GET - Im a legit message",
				name: "NO-FILTEREDNAME"
			};
			expect(filterHttpRequests(record, "FILTEREDNAME")).toEqual(false);
		});
	});

	const getLogObject = (data) => {
		return JSON.parse(data.calls[0][0]);
	};

	describe("RawLogStream", () => {
		const encoding = "utf-8";
		const next = () => true;

		describe.each([true, false])("basic checks - unsafe stream: %s", (unsafeStream) => {
			let stdoutSpy;
			let stream;

			beforeEach(async() => {
				stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(next);

				when(booleanFlag).calledWith(
					BooleanFlags.LOG_UNSAFE_DATA,
					expect.anything(),
					expect.anything()
				).mockResolvedValue(true);
				stream = new RawLogStream("FRONT_END_MIDDLEWARE_LOGGER", unsafeStream);
			});

			it("should write to stdout", async () => {
				const testMessage = {
					msg: "Test Message",
					jiraHost: "host"
				};
				await stream._write(testMessage, encoding, next);
				expect(process.stdout.write).toHaveBeenCalled();
			});

			it("should write msg data", async () => {
				const testMessage = {
					msg: "Epic logging message 9000",
					jiraHost: "host"
				};
				await stream._write(testMessage, encoding, next);
				expect(getLogObject(stdoutSpy.mock).msg).toBe("Epic logging message 9000");
			});

			it("should write additional params data", async () => {
				const testMessage = {
					msg: "Message 8",
					jiraHost: "host",
					breakfast: "Cake"
				};
				await stream._write(testMessage, encoding, next);
				expect(getLogObject(stdoutSpy.mock).breakfast).toBe("Cake");
			});
		});

		describe("safe logger", () => {
			let stdoutSpy;
			let stream;

			beforeEach(() => {
				stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(next);
				stream = new RawLogStream("FRONT_END_MIDDLEWARE_LOGGER", false);
			});

			it("should serialize sensitive data", async () => {
				const testMessage = {
					msg: "Boring message",
					orgName: "ORG"
				};
				await stream._write(testMessage, encoding, next);
				expect(getLogObject(stdoutSpy.mock).orgName).toBe("3340de80aa35aaa011bafb7c45d96514175f57790cb7bc9567a22d644631f1ef");
			});

		});

		describe("unsafe logger", () => {

			describe("unsafe logging feature flag is true", () => {
				let stdoutSpy;
				let stream;

				beforeEach(() => {
					stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(next);

					when(booleanFlag).calledWith(
						BooleanFlags.LOG_UNSAFE_DATA,
						expect.anything(),
						expect.anything()
					).mockResolvedValue(true);
					stream = new RawLogStream("FRONT_END_MIDDLEWARE_LOGGER", true);
				});


				it("should skip logger if no jiraHost", async () => {
					const testMessage = {
						msg: "More messaging",
						orgName: "ORG"
					};
					await stream._write(testMessage, encoding, next);
					expect(process.stdout.write).not.toHaveBeenCalled();
				});

				it("should not serialize sensitive data", async () => {
					const testMessage = {
						msg: "MEOW",
						orgName: "normy Org Name",
						jiraHost: "test-host"
					};
					await stream._write(testMessage, encoding, next);
					expect(getLogObject(stdoutSpy.mock).orgName).toContain("normy Org Name");
				});

				it("should tag unsafe", async () => {
					const testMessage = {
						msg: "Unsafe message",
						jiraHost: "test-host"
					};
					await stream._write(testMessage, encoding, next);
					expect(getLogObject(stdoutSpy.mock).env_suffix).toBe("unsafe");
				});
			});

			describe("unsafe logging feature flag is false", () => {
				let stream;
				beforeEach(async() => {
					jest.spyOn(process.stdout, "write").mockImplementation(next);

					when(booleanFlag).calledWith(
						BooleanFlags.LOG_UNSAFE_DATA,
						expect.anything(),
						expect.anything()
					).mockResolvedValue(false);
					stream = new RawLogStream("FRONT_END_MIDDLEWARE_LOGGER", true);
				});

				it("should skip logging if false feature flag", async () => {
					const testMessage = {
						msg: "Test Message",
						jiraHost: "host"
					};
					await stream._write(testMessage, encoding, next);
					expect(process.stdout.write).not.toHaveBeenCalled();
				});
			});
		});
	});
});
