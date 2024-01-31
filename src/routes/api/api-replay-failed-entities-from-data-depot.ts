import Logger from "bunyan";
import { Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { JiraVulnerability, JiraVulnerabilityBulkSubmitData } from "~/src/interfaces/jira";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, Repository } from "~/src/models/subscription";
import { transformCodeScanningAlert } from "~/src/sync/code-scanning-alerts";
import { transformDependabotAlerts } from "~/src/sync/dependabot-alerts";
import { transformSecretScanningAlert } from "~/src/sync/secret-scanning-alerts";
import { createHashWithSharedSecret } from "~/src/util/encryption";
import { createInstallationClient } from "~/src/util/get-github-client-config";



export const ApiReplyFailedEntitiesFromDataDepotPost = async (req: Request, res: Response): Promise<void> => {

	const MAX_BATCH_SIZE = 5000;

	const log = getLogger("ApiReplyFailedEntitiesFromDataDepotPost");

	const info = (msg: string) => {
		log.info(msg);
		res.write(msg + "\n");
	};
	res.status(200);

	const replayEntities: ReplayEntity[] = req.body?.replayEntities;

	if (!replayEntities?.length || replayEntities.length == 0) {
		info("Replay entities are empty.");
		res.end();
		return;
	}

	if (replayEntities.length > MAX_BATCH_SIZE) {
		info(`Max replay entries can't more than ${MAX_BATCH_SIZE} `);
		return;
	}

	info(`Starting replay for ${replayEntities.length} size`);

	let successfulCount = 0;

	await Promise.all(replayEntities.map(async (replayEntity) => {
		try {
			const { repoId, alertNumber } = getRepoIdAndAlertNumber(replayEntity.identifier, log);
			const subscription = await getSubscription(replayEntity.gitHubInstallationId, replayEntity.hashedJiraHost, log);
			if (!subscription) {
				info(`No subscription found for ${replayEntity.identifier}`);
				return Promise.resolve();
			}
			const gitHubInstallationClient = await createInstallationClient(replayEntity.gitHubInstallationId, subscription.jiraHost, { trigger: "replay-rejected-entities-from-data-depot" }, log, undefined);

			const jiraPayload: JiraVulnerabilityBulkSubmitData = { vulnerabilities: [] };

			let jiraVulnerability;

			if (replayEntity.identifier.startsWith("d")) {
				jiraVulnerability = await getDependabotVulnPayload(gitHubInstallationClient, subscription, repoId, alertNumber, log);

			} else if (replayEntity.identifier.startsWith("s")) {
				jiraVulnerability = await getSecretScanningVulnPayload(gitHubInstallationClient, subscription, repoId, alertNumber, log);

			} else if (replayEntity.identifier.startsWith("c")) {
				jiraVulnerability = await getCodeScanningVulnPayload(gitHubInstallationClient, subscription, repoId, alertNumber, log);

			} else {
				info(`Identifier format unknown ${replayEntity.identifier}`);
			}

			if (!jiraVulnerability) {
				info(`Unable to get alert details for identifier ${replayEntity.identifier}`);
				return Promise.resolve();
			}

			jiraPayload.vulnerabilities.push(jiraVulnerability);

			const jiraClient = await getJiraClient(subscription.jiraHost, replayEntity.gitHubInstallationId, undefined, log);
			const response = await jiraClient?.security.submitVulnerabilities(jiraPayload);
			if (response && response.data?.rejectedEntities.length > 0) {
				info(`Data depot rejected entity with identifier ${replayEntity.identifier}`);
			} else {
				info(`Replay entity processed successfully for ${replayEntity.identifier}`);
				successfulCount++;
			}
		} catch (err) {
			res.write(`Failed to process replay entity with identifier ${replayEntity.identifier}\n`);
			log.error({ err }, `Failed to process replay entity with identifier ${replayEntity.identifier}\n`);
		}
	}));
	info(`Total replay entities processed successfully - ${successfulCount}/${replayEntities.length}`);
	res.end();
};

const getDependabotVulnPayload = async (
	gitHubInstallationClient: GitHubInstallationClient,
	subscription: Subscription,
	repoId: number,
	alertNumber: number,
	logger: Logger
): Promise<JiraVulnerability | undefined> => {
	const repoSyncState = await RepoSyncState.findByRepoId(subscription, repoId);
	if (repoSyncState) {
		const { data: dependabotAlertResponseItem } = await gitHubInstallationClient.getDependabotAlert(repoSyncState.repoOwner, repoSyncState.repoName, alertNumber);
		if (dependabotAlertResponseItem) {
			logger.info(`Fetched dependabot alert successfully from GitHub repoId - ${repoId}, alert ${alertNumber}`);
			const repository: Repository = {
				id: repoId,
				full_name: repoSyncState.repoFullName,
				name: repoSyncState.repoName,
				owner: { login: repoSyncState.repoOwner },
				html_url: repoSyncState.repoUrl,
				updated_at: repoSyncState.updatedAt.toString()
			};
			const vulnPayload = await transformDependabotAlerts([dependabotAlertResponseItem], repository, subscription.jiraHost, logger, undefined);
			logger.info(`Transformed to Jira vulnerability successfully repoId - ${repoId}, alert ${alertNumber}`);
			if (vulnPayload.vulnerabilities?.length > 0) {
				return vulnPayload.vulnerabilities[0];
			}

		}
		logger.info(`Failed to fetch dependabot alert from GitHub repoId - ${repoId}, alert ${alertNumber}`);
	}
	return undefined;
};

const getCodeScanningVulnPayload = async (
	gitHubInstallationClient: GitHubInstallationClient,
	subscription: Subscription,
	repoId: number,
	alertNumber: number,
	logger: Logger
): Promise<JiraVulnerability | undefined> => {
	const repoSyncState = await RepoSyncState.findByRepoId(subscription, repoId);
	if (repoSyncState) {
		const { data: codeScanningAlertResponseItem } = await gitHubInstallationClient.getCodeScanningAlert(repoSyncState.repoOwner, repoSyncState.repoName, alertNumber);
		if (codeScanningAlertResponseItem) {
			logger.info(`Fetched code scanning alert successfully from GitHub repoId - ${repoId}, alert ${alertNumber}`);
			const repository: Repository = {
				id: repoId,
				full_name: repoSyncState.repoFullName,
				name: repoSyncState.repoName,
				owner: { login: repoSyncState.repoOwner },
				html_url: repoSyncState.repoUrl,
				updated_at: repoSyncState.updatedAt.toString()
			};
			logger.info(`Transformed to Jira vulnerability successfully repoId - ${repoId}, alert ${alertNumber}`);
			const vulnPayload = await transformCodeScanningAlert([codeScanningAlertResponseItem], repository, subscription.jiraHost, logger, undefined);
			if (vulnPayload.vulnerabilities?.length > 0) {
				return vulnPayload.vulnerabilities[0];
			}

		}
		logger.info(`Failed to fetch code scanning alert from GitHub repoId - ${repoId}, alert ${alertNumber}`);
	}
	return undefined;
};

const getSecretScanningVulnPayload = async (
	gitHubInstallationClient: GitHubInstallationClient,
	subscription: Subscription,
	repoId: number,
	alertNumber: number,
	logger: Logger
): Promise<JiraVulnerability | undefined> => {
	const repoSyncState = await RepoSyncState.findByRepoId(subscription, repoId);
	if (repoSyncState) {
		const { data: secretScanningAlertResponseItem } = await gitHubInstallationClient.getSecretScanningAlert(alertNumber, repoSyncState.repoOwner, repoSyncState.repoName);
		if (secretScanningAlertResponseItem) {
			logger.info(`Fetched secret scanning alert successfully from GitHub repoId - ${repoId}, alert ${alertNumber}`);
			const repository: Repository = {
				id: repoId,
				full_name: repoSyncState.repoFullName,
				name: repoSyncState.repoName,
				owner: { login: repoSyncState.repoOwner },
				html_url: repoSyncState.repoUrl,
				updated_at: repoSyncState.updatedAt.toString()
			};
			logger.info(`Transformed to Jira vulnerability successfully repoId - ${repoId}, alert ${alertNumber}`);
			const vulnPayload = await transformSecretScanningAlert([secretScanningAlertResponseItem], repository, subscription.jiraHost, logger, undefined);
			if (vulnPayload.vulnerabilities?.length > 0) {
				return vulnPayload.vulnerabilities[0];
			}

		}
		logger.info(`Failed to fetch secret scanning alert from GitHub repoId - ${repoId}, alert ${alertNumber}`);
	}
	return undefined;
};

const getSubscription = async (gitHubInstallationId: number, hashedJiraHost: string, logger: Logger): Promise<Subscription | undefined> => {
	const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId, undefined);
	const filteredSubscriptions = subscriptions.filter(subscription => createHashWithSharedSecret(subscription.jiraHost) == hashedJiraHost);
	if (filteredSubscriptions.length == 0) {
		logger.info(`Not found any subscription for GitHub Installation Id ${gitHubInstallationId}, Jira ${hashedJiraHost}`);
		return undefined;
	}
	logger.info({ subscriptions: filteredSubscriptions, count: filteredSubscriptions.length }, `Found subscription for Jira ${hashedJiraHost}`);
	return filteredSubscriptions[0];
};

const getRepoIdAndAlertNumber = (identifier: string, logger: Logger) => {
	const identifierParts = identifier?.split("-");
	if (identifierParts.length !== 3) {
		logger.info(`Incorrect identifier format ${identifier}`);
	}
	return { repoId: +identifierParts[1], alertNumber: +identifierParts[2] };
};

type ReplayEntity = {
	gitHubInstallationId: number,
	identifier: string,
	hashedJiraHost: string
}