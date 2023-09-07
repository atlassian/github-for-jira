import { RedisOptions } from "ioredis";
import { getRedisInfo } from "./redis-info";

describe("getRedisInfo", () => {
	let redisOptions: RedisOptions;

	it("should set the port to port envVar value", () => {
		process.env.REDISX_CACHE_PORT = "9000";
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.port).toBe(9000);
	});

	it("should set the port to default value", () => {
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.port).toBe(6379);
	});

	it("should set the host to host envVar value", () => {
		process.env.REDISX_CACHE_HOST = "127.0.0.999";
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.host).toBe("127.0.0.999");
	});

	it("should set the host to default", () => {
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.host).toBe("127.0.0.1");
	});

	it("should set tls true when production", () => {
		process.env.REDISX_CACHE_TLS_ENABLED = "true";
		redisOptions = getRedisInfo("mock-connection");
		expect(typeof redisOptions.tls?.checkServerIdentity).toBe("function");
	});

	it("should set tls true when not production", () => {
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.tls).toBeUndefined();
	});

	it("should have a reconnectOnError function", () => {
		redisOptions = getRedisInfo("mock-connection");
		expect(typeof redisOptions.reconnectOnError).toBe("function");
	});

	it("should return 1 if err.message includes 'READONLY'", () => {
		redisOptions = getRedisInfo("mock-connection");
		const errorWithReadonly: Error = new Error("READONLY Error");
		expect(redisOptions.reconnectOnError!(errorWithReadonly)).toBe(1);
	});

	it("should return false for other errors", () => {
		redisOptions = getRedisInfo("mock-connection");
		const errorWithoutReadonly: Error = new Error("RANDOM Error");
		expect(redisOptions.reconnectOnError!(errorWithoutReadonly)).toBe(false);
	});

	it("should set the connectionName to the provided value", () => {
		redisOptions = getRedisInfo("mock-connection");
		expect(redisOptions.connectionName).toBe("mock-connection");
	});

});
