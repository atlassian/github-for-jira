import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

export const generateRepoId = ((): () => number => {
	let repoIdCounter = 0;

	return () => {
		repoIdCounter++;
		return repoIdCounter;
	};
})();

// Function to generate a unique repository name
export const generateRepoName = (): string => {
	// Example: Generates a name with "repo-" prefix and a random number between 0 and 999
	const name = `repo-${Math.floor(Math.random() * 1000)}`;
	return name;
};


// Function to generate a unique repository owner
export const generateUniqueRepoOwner = (): string => {
	const prefix = "repo-owner";
	const uniqueId = Math.floor(Math.random() * 1000); // Generate a random number

	return `${prefix}-${uniqueId}`;
};

export const createRepositories = async (subscriptions: Subscription[]): Promise<RepoSyncState[]> => {
	const repositories: RepoSyncState[] = [];

	for (const subscription of subscriptions) {
		const repoOwner = generateUniqueRepoOwner(); // Function to generate unique repo owner

		const repository: RepoSyncState = await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 3,
			repoName: "testing-repo",
			repoOwner: repoOwner,
			repoFullName: `${repoOwner}/testing-repo`,
			repoUrl: `github.com/${repoOwner}/testing-repo`
		});

		repositories.push(repository);
	}

	return repositories;
};
