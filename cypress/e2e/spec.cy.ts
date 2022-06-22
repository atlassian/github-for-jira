/*
describe.skip('Install', () => {
  it('passes', () => {
		// TODO - Could be placed someer a tad more glabal?
		Cypress.on('uncaught:exception', (err, runnable) => {
			return false
		})
		// Will redirect to atlassian id
		cy.visit('https://joshkaye2e.atlassian.net/plugins/servlet/upm');

		// enter user email
		cy.get("#username")
			.type("jkay10@hotmail.com{enter}");
		// enter user password
		cy.get("#password")
			.type("password!{enter}");

		// cy.visit('https://joshkaye2e.atlassian.net/plugins/servlet/upm');
		// Install the app
		cy.wait(999);
		// cy.get("#upm-upload").click();
		// cy.get("#upm-upload-url")
		// 	.type("https://jkay-tunnel.public.atlastunnel.com/jira/atlassian-connect.json{enter}");
		//
		// // TODO - better selector?
		// cy.get(".aui-button.aui-button-primary.confirm").click();

		// Get Started
		// TODO - better selector?
		cy.wait(15000);

		cy.get("body")
			.should("be.visible");
  })
})
*/
describe('Configure', () => {
	it('passes', () => {

		// TODO - Could be placed someer a tad more glabal?
		Cypress.on('uncaught:exception', (err, runnable) => {
			return false
		})
		// Will redirect to atlassian id
		cy.visit('https://joshkaye2e.atlassian.net');

		// enter user email
		cy.get("#username")
			.type("jkay10@hotmail.com{enter}");
		// enter user password & submit
		cy.get("#password")
			.type("password!{enter}");


		// Top level menu APPS > MANAGE YOUR APPS 
		cy.get("[data-testid=\"overflow-menu-trigger\"]")
			.click();
		cy.get(":nth-child(3) > :nth-child(1) > .css-f6nuwn")
			.click();
		cy.get("[href=\"/plugins/servlet/upm\"]")
			.click();

		// left han nav - github
		cy.get("[aria-label=\"GitHub\"] > .css-6oixoe")
			.click();

	})
})
/*

describe('Configure', () => {
	it('test', () => {

		// TODO - Could be placed someer a tad more glabal?
		Cypress.on('uncaught:exception', (err, runnable) => {
			return false
		})
		// Will redirect to atlassian id

		// cy.visit('https://joshkaye2e.atlassian.net/plugins/servlet/ac/com.github.integration.joshkayjira/github-post-install-page');
		// cy.visit('https://joshkaye2e.atlassian.net');
		// cy.wait(10000);
		cy.visit('https://joshkaye2e.atlassian.net/plugins/servlet/ac/com.github.integration.joshkayjira/gh-addon-admin?s=com.github.integration.joshkayjira__gh-addon-admin');
		cy.get('.css-1p5j0a7 > a').click();

		// enter user email
		cy.get("#username")
			.type("jkay10@hotmail.com{enter}");
		// enter user password
		cy.get("#password")
			.type("password!{enter}");


		cy.wait(10000);

	})
})
 */

