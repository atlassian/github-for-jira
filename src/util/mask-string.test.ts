/* eslint-disable @typescript-eslint/no-explicit-any */
import maskString from "utils/mask-string";

const testData = [
	{
		actual: "nico-robin",
		result: "n********n"
	},
	{
		actual: "boa-hancock",
		result: "b*********k"
	},
	{
		actual: "nerfertari-vivi",
		result: "n*************i"
	}
];

describe("Test for mask string", () => {
	testData.forEach(datum => {
		const { actual, result } = datum;
		it(`Testing ${actual} for ${result}`, () => {
			expect(maskString(actual)).toBe(result);
		});
	});
});
