import { RedisOptions } from "ioredis";
import { getRedisInfo } from "./redis-info";

describe("getRedisInfo", () => {
	let redisOptions: RedisOptions;

	beforeEach(() => {
		process.env.REDISX_CACHE_HOST = "127.0.0.999";
		process.env.REDISX_CACHE_PORT = "9000";
		process.env.REDISX_CACHE_TLS_ENABLED = "true";
		redisOptions = getRedisInfo("mock-connection");
	});

	it("should set the port to port envVar value", () => {
		expect(redisOptions.port).toBe(9000);
	});

	it("should set the host to host envVar value", () => {
		expect(redisOptions.host).toBe("127.0.0.999");
	});

	it("should set tls true when envVar true", () => {
		expect(typeof redisOptions.tls?.checkServerIdentity).toBe("function");
	});

	it("should have a reconnectOnError function", () => {
		expect(typeof redisOptions.reconnectOnError).toBe("function");
	});

	it("should return 1 if err.message includes 'READONLY'", () => {
		const errorWithReadonly: Error = new Error("READONLY Error");
		expect(redisOptions.reconnectOnError!(errorWithReadonly)).toBe(1);
	});

	it("should return false for other errors", () => {
		const errorWithoutReadonly: Error = new Error("RANDOM Error");
		expect(redisOptions.reconnectOnError!(errorWithoutReadonly)).toBe(false);
	});

	it("should set the connectionName to the provided value", () => {
		expect(redisOptions.connectionName).toBe("mock-connection");
	});

});

describe("getRedisInfo without envvars", () => {
	let redisOptions: RedisOptions;

	beforeEach(() => {
		delete process.env.REDISX_CACHE_HOST;
		delete process.env.REDISX_CACHE_PORT;
		delete process.env.REDISX_CACHE_TLS_ENABLED ;
		redisOptions = getRedisInfo("mock-connection");
	});

	it("should set the port to default value", () => {
		expect(redisOptions.port).toBe(6379);
	});

	it("should set the host to default", () => {
		expect(redisOptions.host).toBe("127.0.0.1");
	});

	it("should set tls to undefined by default", () => {
		expect(redisOptions.tls).toBeUndefined();
	});

});
