import { Role, test } from "testcafe";

const userRole = Role("https://rachellerathbonee2e.atlassian.net/login", async t => {
	await t
		.typeText("#username", "rachellerathbone@gmail.com")
		.pressKey("enter")
		.typeText("#password", "password!")
		.pressKey("enter");
});

fixture `Example`
	.page`https://rachellerathbonee2e.atlassian.net/plugins/servlet/upm`;

// eslint-disable-next-line jest/no-done-callback
test("Example", async (t) => {
	await t
		.useRole(userRole)
		.click(".css-1hqmh00:nth-of-type(2) > .css-6oixoe")
		.switchToIframe("iframe");
});
