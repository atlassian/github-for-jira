const { defineConfig } = require('cypress')
require('dotenv').config();

module.exports = defineConfig({
	chromeWebSecurity: false,
	experimentalSourceRewriting: true,
	// clientRoute: "/",
	env: {
		JIRA_USERNAME: "jkay10@hotmail.com",
		JIRA_PASSWORD:  "password!",
		JIRA_URL: "https://joshkaye2e.atlassian.net"
	},
	e2e: {
	}
})
