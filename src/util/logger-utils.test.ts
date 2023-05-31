import { filterHttpRequests, SafeRawLogStream } from "./logger-utils";
import { INFO } from "bunyan";

describe("Logger Utils", () => {

	describe("filterHttpRequests with Request keywords", () => {

		it("should return false filterHttpRequests undefined", () => {
			const record = {
				msg: "GET - Im a filterable msg",
				name: "NO-FILTEREDNAME"
			};
			expect(filterHttpRequests(record)).toEqual(false);
		});

		it("should return true for msg with filterHttpRequests true", () => {
			const record = {
				msg: "GET - ima get filtered",
				name: "FILTEREDNAME",
				filterHttpRequests: true
			};
			expect(filterHttpRequests(record)).toEqual(true);
		});

		it("should return false for msg with filterHttpRequests false", () => {
			const record = {
				msg: "GET - Im a legit message",
				name: "NO-FILTEREDNAME",
				filterHttpRequests: false
			};
			expect(filterHttpRequests(record)).toEqual(false);
		});
	});

	describe.each([true, false, undefined])("filterHttpRequests without Request keywords", (filterRequests) => {
		it("should return false for msg with filterHttpRequests as true and no valid request keywords", () => {
			const record = {
				msg: "STUFF - Im a legit message",
				name: "FILTEREDNAME",
				filterHttpRequests: filterRequests
			};
			expect(filterHttpRequests(record)).toEqual(false);
		});
	});

	const getLogObject = (data) => {
		return JSON.parse(data.calls[0][0]);
	};

	describe("RawLogStream", () => {
		const encoding = "utf-8";
		const next = () => true;

		describe("safe logger", () => {
			let stdoutSpy;
			let stream;

			beforeEach(() => {
				stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(next);
				stream = new SafeRawLogStream();
			});

			it("should hash sensitive data", async () => {
				const testMessage = {
					msg: "Boring message",
					orgName: "ORG"
				};
				await stream._write(testMessage, encoding, next);
				expect(getLogObject(stdoutSpy.mock).orgName).toBe("3340de80aa35aaa011bafb7c45d96514175f57790cb7bc9567a22d644631f1ef");
			});

			it("should not log unsafe data to standard logger", async () => {
				const testMessage = {
					msg: "More messaging",
					unsafe: true,
					orgName: "ORG",
					level: INFO
				};
				await stream._write(testMessage, encoding, next);
				expect(process.stdout.write).not.toHaveBeenCalled();
			});

		});
	});
});
