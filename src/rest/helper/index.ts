import AsyncWrapper from "express-async-handler";

//too hard, don't want to type this
/* eslint-disable @typescript-eslint/no-explicit-any */
export const errorWrapper = (name:string, handler: any): any => {
	const wrapper = AsyncWrapper(handler);
	Object.defineProperty(wrapper, "name", { get: () => name });
	return wrapper;
};

