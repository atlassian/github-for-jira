import _ from "lodash";
import { mapEnvironment } from "../../../src/transforms/deployment";

describe("deployment environment mapping", () => {
	test("classifies known environments correctly", () => {
		// Development
		expect(mapEnvironment("development")).toBe("development");
		expect(mapEnvironment("dev")).toBe("development");
		expect(mapEnvironment("trunk")).toBe("development");

		// Testing
		expect(mapEnvironment("testing")).toBe("testing");
		expect(mapEnvironment("test")).toBe("testing");
		expect(mapEnvironment("tests")).toBe("testing");
		expect(mapEnvironment("tst")).toBe("testing");
		expect(mapEnvironment("integration")).toBe("testing");
		expect(mapEnvironment("integ")).toBe("testing");
		expect(mapEnvironment("intg")).toBe("testing");
		expect(mapEnvironment("int")).toBe("testing");
		expect(mapEnvironment("acceptance")).toBe("testing");
		expect(mapEnvironment("accept")).toBe("testing");
		expect(mapEnvironment("acpt")).toBe("testing");
		expect(mapEnvironment("qa")).toBe("testing");
		expect(mapEnvironment("qc")).toBe("testing");
		expect(mapEnvironment("control")).toBe("testing");
		expect(mapEnvironment("quality")).toBe("testing");

		// Staging
		expect(mapEnvironment("staging")).toBe("staging");
		expect(mapEnvironment("stage")).toBe("staging");
		expect(mapEnvironment("stg")).toBe("staging");
		expect(mapEnvironment("preprod")).toBe("staging");
		expect(mapEnvironment("model")).toBe("staging");
		expect(mapEnvironment("internal")).toBe("staging");

		// Production
		expect(mapEnvironment("production")).toBe("production");
		expect(mapEnvironment("prod")).toBe("production");
		expect(mapEnvironment("prd")).toBe("production");
		expect(mapEnvironment("live")).toBe("production");
	});

	test("classifies known environments with prefixes and/or postfixes correctly", () => {
		expect(mapEnvironment("prod-east")).toBe("production");
		expect(mapEnvironment("prod_east")).toBe("production");
		expect(mapEnvironment("east-staging")).toBe("staging");
		expect(mapEnvironment("qa:1")).toBe("testing");
		expect(mapEnvironment("mary-dev:1")).toBe("development");
		expect(mapEnvironment("trunk alpha")).toBe("development");
		expect(mapEnvironment("production(us-east)")).toBe("production");
		expect(mapEnvironment("prd (eu-central)")).toBe("production");
	});

	test("ignores case", () => {
		expect(mapEnvironment("Staging")).toBe("staging");
		expect(mapEnvironment("PROD-east")).toBe("production");
	});

	test("ignores diacritics", () => {
		expect(mapEnvironment("stàging")).toBe("staging");
	});

	test("classifies unknown environment names as 'unmapped'", () => {
		expect(mapEnvironment("banana-east")).toBe("unmapped");
		expect(mapEnvironment("internet")).toBe("unmapped");
	});
});
