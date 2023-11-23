import { EventHint } from "@sentry/node";
import { SentryScopeProxy } from "./sentry-scope-proxy";

describe("SentryScopeProxy", () => {
	describe(".processEvent", () => {
		it("adds scope proxy to event", () => {
			const scope = new SentryScopeProxy();
			scope.setExtra("foo", { hi: "hello" });

			const event = { extra: {} };
			const hint = {
				originalException: {
					sentryScope: scope
				}
			};

			const returnedEvent = SentryScopeProxy.processEvent(event, hint as unknown as EventHint);

			expect(returnedEvent.extra).toEqual({ foo: { hi: "hello" } });
		});

		it("does nothing with normal error", () => {
			const event = { extra: {} };
			const hint = { originalException: {} } as EventHint;

			const returnedEvent = SentryScopeProxy.processEvent(event, hint);

			expect(returnedEvent.extra).toEqual({});
		});
	});

	describe("#setExtra", () => {
		it("assigns key to value", () => {
			const scope = new SentryScopeProxy();

			scope.setExtra("blah", { hello: "world" });

			expect(scope.extra).toEqual({ blah: { hello: "world" } });
		});
	});

	describe("#setFingerprint", () => {
		it("assigns key to value", () => {
			const scope = new SentryScopeProxy();

			scope.setFingerprint(["foo", "bar"]);

			expect(scope.fingerprint).toEqual(["foo", "bar"]);
		});
	});

	describe("#addTo", () => {
		it("assigns extra and fingerprint to event", () => {
			const event = { extra: {}, fingerprint: ["original"] };
			const scope = new SentryScopeProxy();
			scope.setExtra("data", { hello: "world" });
			scope.setFingerprint(["foo", "bar"]);

			scope.addTo(event);

			expect(event.extra).toEqual({ data: { hello: "world" } });
			expect(event.fingerprint).toEqual(["foo", "bar"]);
		});

		it("overrides value in extra", () => {
			const event = { extra: { data: "original value", other: "something" } };
			const scope = new SentryScopeProxy();
			scope.setExtra("data", { hello: "world" });

			scope.addTo(event);

			expect(event.extra).toEqual({ data: { hello: "world" }, other: "something" });
		});

		it("doesn't set fingerprint when not set", () => {
			const event = { extra: {}, fingerprint: ["original"] };
			const scope = new SentryScopeProxy();

			scope.addTo(event);

			expect(event.fingerprint).toEqual(["original"]);
		});
	});
});
