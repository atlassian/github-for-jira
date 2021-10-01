import supertest from "supertest";
import { createProbot } from "probot";
import * as PrivateKey from "probot/lib/private-key";
import configureAndLoadApp from "../../src/configure-robot";
import {Writable} from "stream";

describe('configure-robot', () => {
	let probot;
	let logHistory = '';

	beforeEach(async () => {
		logHistory = '';
		probot = createProbot({
			id: Math.floor(Math.random() * 1000),
			cert: PrivateKey.findPrivateKey()!,
		});
		configureAndLoadApp(probot);
		const stream = probot.logger.streams.pop();

		probot.logger.addStream({
			type: "stream",
			stream: new Writable({
				write: function(chunk, encoding, next) {
					const spy = jest.spyOn(chunk, 'toString');
					stream.stream.write(chunk, encoding, next);
					// First call to test if should filter or not
					// 2nd call is to write... Ugly, but working. Please feel free to fix.
					if (spy.mock.calls.length > 1) {
						logHistory += chunk.toString();
					}
				}
			}),
			level: 'info'
		});

	});

	test('frontend is working', async () => {
		await supertest(probot.server).get("/jira/atlassian-connect.json").expect(response => {
			expect(response.status).toBe(200);
			expect(response.body.apiVersion).toBe(1);
		});
	});

	test('does not log HTTP requests', async () => {
		probot.logger.info('test log');
		await supertest(probot.server).get("/jira/atlassian-connect.json").expect(_ => {
			expect(logHistory).not.toContain("atlassian-connect.json");
			expect(logHistory).toContain("test log");
		});
	});
});
