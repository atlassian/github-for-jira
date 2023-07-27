export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});
