export const deleteRepository = async (context, jiraClient): Promise<void> => {
	context.log(`Deleting dev info for repo ${context.payload.repository?.id}`);

	await jiraClient.devinfo.repository.delete(
		context.payload.repository?.id
	);
};
