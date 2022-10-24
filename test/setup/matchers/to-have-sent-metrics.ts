/* eslint-disable @typescript-eslint/no-explicit-any,jest/no-commented-out-tests */
import { statsd }  from "config/statsd";
/*

This matcher makes it easier to write tests against Datadog metrics
by providing the `toHaveSentMetrics` matcher.

Examples:

it('makes sure a metric of a certain type and name was sent', async () => {
  await expect(async () => {
    await someCode()
  }).toHaveSentMetrics({
    name: 'jira-integration.my-metric',
    type: 'c', // c for count, h for histogram, etc
  })
})

it('checks value', async () => {
  await expect(async () => {
    await someCode()
  }).toHaveSentMetrics({
    name: 'jira-integration.my-metric',
    type: 'c',
    value: 1 // incremented by 1
  })
})

it('checks dynamic value', async () => {
  await expect(async () => {
    await someCode()
  }).toHaveSentMetrics({
    name: 'jira-integration.my-metric',
    type: 'c',
    value: (value) => value > 0 // make sure value is greater than 1
  })
})

it('checks tags too', async () => {
  await expect(async () => {
    await someCode()
  }).toHaveSentMetrics({
    name: 'jira-integration.my-metric',
    type: 'c',
    tags: { code: 200 } // will ensure that `code:200` is present
  })
})

*/
import { diff } from "jest-diff";

const parseStatsdMessage = (stastsdMessage: string): StatsDMessage => {
	const [metric, type, tagsString] = stastsdMessage.split("|");
	const [name, value] = metric.split(":");
	const tags = {};

	tagsString.substring(1).split(",").map((tagString) => {
		const [key, value] = tagString.split(":");
		tags[key] = value;
	});

	return {
		name,
		value: parseInt(value),
		type,
		tags
	};
};

interface StatsDMessage {
	name: string;
	value: number;
	type: string;
	tags: Record<string, string>;
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace jest {
		interface Matchers<R> {
			toHaveSentMetrics(...expectedMetrics: any[]): R;
		}
	}
}

// TODO: add better typing for metric
expect.extend({
	// TODO: expect needs the first argument to be what's in the `expect(value)`
	// TODO: this doesn't work, probably something to do with statsd not keeping tabs when testing?
	toHaveSentMetrics(...expectedMetrics: any[]) {
		statsd.mockBuffer = [];
		const actualMetrics = statsd.mockBuffer.map((message) => parseStatsdMessage(message));
		const matchingMetrics: StatsDMessage[] = [];

		expectedMetrics.forEach((expectedMetric) => actualMetrics.find((actualMetric) => {
			const matchingName = actualMetric.name === expectedMetric.name;
			const matchingType = actualMetric.type === expectedMetric.type;

			let matchingValue;
			// eslint-disable-next-line no-prototype-builtins
			if (!expectedMetric.hasOwnProperty("value")) {
				matchingValue = true;
			} else if (typeof expectedMetric.value === "function") {
				matchingValue = expectedMetric.value(actualMetric.value);
			} else {
				matchingValue = actualMetric.value === expectedMetric.value;
			}

			if (matchingName && matchingType && matchingValue) {
				let matchingTags = true;
				if (expectedMetric.tags) {
					Object.entries(expectedMetric.tags).forEach(([name, expectedValue]) => {
						if (actualMetric.tags[name] !== expectedValue) {
							matchingTags = false;
						}
					});
				}

				if (matchingTags) {
					matchingMetrics.push(actualMetric);
				}
			}
		}));

		const pass = matchingMetrics.length === expectedMetrics.length;

		return {
			message: () => {
				const diffString = diff(expectedMetrics, actualMetrics, { expand: true });
				return `${this.utils.matcherHint("toHaveSentMetrics", "function", "metrics")}\n\n${diffString}`;
			},
			pass
		};
	}
});
