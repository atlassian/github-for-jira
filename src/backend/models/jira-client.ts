import getAxiosInstance from "../jira/client/axios";
import { AxiosInstance } from "axios";
import Installation from "./installation";
import Logger from "bunyan";

// TODO: why are there 2 jira clients?
export default class JiraClient {
	axios: AxiosInstance;

	constructor(installation: Installation, log: Logger) {
		this.axios = getAxiosInstance(installation.jiraHost, installation.sharedSecret, log);
	}

	/*
	 * Tests credentials by making a request to the Jira API
	 *
	 * @return {boolean} Returns true if client has access to Jira API
	 */
	async isAuthorized(): Promise<boolean> {
		try {
			return (await this.axios.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")).status === 200;
		} catch (error) {
			if (!error.response) {
				throw error;
			}
			return false;
		}
	}
}
