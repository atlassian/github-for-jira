import { RequestHandler } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import AsyncWrapper from "express-async-handler";

//too hard, don't want to type this
/* eslint-disable @typescript-eslint/no-explicit-any */
export const errorWrapper = (name:string, handler: (...args: Parameters<RequestHandler<ParamsDictionary, any, any, any, any>>) => Promise<void>): RequestHandler<ParamsDictionary, any, any, any, Record<string, any>> => {
	const wrapper = AsyncWrapper(handler);
	Object.defineProperty(wrapper, "name", { get: () => name });
	return wrapper;
};
