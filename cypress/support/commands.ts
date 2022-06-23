// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//

import { unescape } from "lodash";

Cypress.Commands.add(
	"loginToJira",
	(username: string = Cypress.env("JIRA_USERNAME"), password: string = Cypress.env("JIRA_PASSWORD")) => {

		cy.log(`Trying to login to jira as ${username}`);
				const jiraUrl = Cypress.env("JIRA_URL");
		/*		const client_id = Cypress.env("auth0_client_id");
				const client_secret = Cypress.env("auth0_client_secret");
				const audience = Cypress.env("auth0_audience");
				const scope = Cypress.env("auth0_scope");*/


		cy.request({
			method: "GET",
			url: `${jiraUrl}/login?application=jira`,
			followRedirect: true,
			headers: {
				"Accept": "*/*",
				"Content-Type": "text/html",
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36"
			}
		}).then((response) => {
			const html = response.body as string;
			cy.log("body: " + html);
			const matches = html.match(/data-app-state="(.*?)"/);
			cy.log("matches: " + JSON.stringify(matches));
			if (!matches) {
				cy.log("Error logging in");
				throw new Error("Cannot login to jira");
			}
			const { csrfToken } = JSON.parse(unescape(matches[1]));

			cy.request({
				method: "POST",
				url: `https://auth.atlassian.com/co/authenticate`,
				body: {
					aaCompatible: true,
					password,
					username,
					state: {
						anonymousId: "b9c311d0-2dd6-4019-a8b0-6b506d462f35", // random GUID
						csrfToken
					}
				}
			}).then((response) => {
				cy.log("Setting cookies");
				cy.log(response.headers["set-cookie"] as string);
				cy.window().then(win => win.document.cookie = response.headers["set-cookie"] as string);
			});
		});
	}
);
