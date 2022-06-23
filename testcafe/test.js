import { Selector } from 'testcafe';


fixture`Getting Started`
	.page`https://rachellerathbonee2e.atlassian.net/plugins/servlet/upm`;

test('Example', async t => {
	await t
		.typeText('#username', 'rachellerathbone@gmail.com')
		.pressKey('enter')
		.typeText('#password', 'password!')
		.pressKey('enter')
		.click('.css-1hqmh00:nth-of-type(2) > .css-6oixoe')
		.switchToIframe('iframe')
});
