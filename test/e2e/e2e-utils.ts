import { Browser, Page } from "@playwright/test";
import fs from "fs";
import { STATE_PATH, TestDataRole } from "test/e2e/constants";

export const newPage = async <T>(browser: Browser, func: (page: Page) => Promise<T>): Promise<T> => {
	const page = await browser.newPage();
	const result = await func(page);
	await page.close();
	return result;
};

export const newContextPage = async <T>(browser: Browser, func: (page: Page) => Promise<T>): Promise<T> => {
	const context = await browser.newContext();
	const page = await context.newPage();
	const result = await func(page);
	await page.close();
	await context.close();
	return result;
};

export const eachContextPage = async (browser: Browser, funcs: Array<(page: Page) => Promise<unknown>>): Promise<void> => {
	const pages = await Promise.all(funcs.map(async (func) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await func(page);
		return page;
	}));
	await Promise.all(pages.map(page => page.close()));
};

export const clearState = () => {
	fs.existsSync(STATE_PATH) && fs.rmdirSync(STATE_PATH, { recursive: true });
};

export const stateExists = (role: TestDataRole): boolean => {
	return !!role.storage && fs.existsSync(role.storage);
};
