import _ from "lodash";
import { mapEnvironment } from "../../../src/transforms/deployment";

describe("deployment environment mapping", () => {
	const exampleEnvironmentNames = [
		"development",
		"dev",
		"trunk",
		"dev",
		"testing",
		"test",
		"tests",
		"tst",
		"integration",
		"integ",
		"intg",
		"int",
		"acceptance",
		"accept",
		"acpt",
		"qa",
		"qc",
		"control",
		"quality",
		"staging",
		"stage",
		"stg",
		"preprod",
		"model",
		"internal",
		"production",
		"prod",
		"live",
		"some-random-name",
	]
	// Variations of the example names, e.g. "prod-east" is considered a variation of "prod"
	const exampleEnvironmentNameVariations = _.flatMap(exampleEnvironmentNames, environmentName => [
		environmentName,
		// Different case
		environmentName.toUpperCase(),
		// Add some prefixes & postfixes
		`${environmentName}-east`,
		`${environmentName}-eu-west`,
		`east-${environmentName}`,
		`jane-${environmentName}-local`,
		// Check some other common separators
		`${environmentName}:east`,
		`${environmentName}_east`,
		`${environmentName}/east`,
		`${environmentName} east`,
	]);

	it("should transform commonly used environment names to the expected environment types", () => {
		const environmentTypesToEnvironmentNames = _.groupBy(exampleEnvironmentNameVariations, mapEnvironment);

		expect(environmentTypesToEnvironmentNames).toMatchSnapshot();
	});
});
