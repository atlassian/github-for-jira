/// <reference types="cypress" />
/// <reference types="cypress-iframe" />

declare namespace Cypress {
	interface Chainable<Subject = any> {
		console(level: string): Chainable<Subject>;

		loginToJira(email?: string, password?: string): Chainable<Subject>;

		// login(email: string, password: string): Chainable<void>
		// drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
		// dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
		// visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
	}
}
