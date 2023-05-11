import { validateApiKeyInputsAndReturnErrorIfAny } from "utils/api-key-validator";

describe("api-key-validator", () => {
	it("does nothing if apiKeyHeaderName is empty", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			undefined,
			Array.from({ length: 9000 }, () => "x").join("")
		)).toBeUndefined();
	});

	it("returns undefined if all good", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			"foo",
			"bar"
		)).toBeUndefined();
	});

	it("checks length of apiKeyHeaderName", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			Array.from({ length: 2000 }, () => "x").join(""),
			"bar"
		)).toStrictEqual("apiKeyHeaderName max length is 1024");
	});

	it("checks apiKeyHeaderName is not an existing header", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			"authorization",
			"bar"
		)).toStrictEqual("Provided apiKeyHeaderName cannot be used as API key header");
	});

	it("checks apiKeyValue does not exceed allowed length", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			"bar",
			Array.from({ length: 10000 }, () => "x").join("")
		)).toStrictEqual("apiKeyValue max length is 8096");
	});

	it("checks apiKeyValue is not empty", () => {
		expect(validateApiKeyInputsAndReturnErrorIfAny(
			"bar",
			undefined
		)).toStrictEqual("apiKeyHeaderName was provided but apiKeyValue was empty");
	});
});
