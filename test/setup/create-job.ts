/* eslint-disable @typescript-eslint/no-explicit-any */
// Create a job stub with data
import {Hub} from "@sentry/types/dist/hub";

export default ({ data, opts }: { data: any, opts?: any }) => {
	const defaultOpts = {
		attempts: 3,
		removeOnFail: true,
		removeOnComplete: true
	};

	return {
		data,
		opts: Object.assign(defaultOpts, opts || {}),
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		sentry: { setUser: jest.fn() } as Hub
	};
};
