export const generateCreatePullRequestUrl = (baseUrl: string, name: string, issueKey: string[] | null) => {
	const issueKeyString: string | undefined = issueKey?.join(" ");
	let title;
	if (issueKeyString) {
		title = encodeURIComponent(`${issueKeyString} ${name}`);
	} else {
		title = encodeURIComponent(`${name}`);
	}
	console.log(issueKey);
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log('GENERATOR');
	console.log(`${baseUrl}/compare/${name}?title=${title}`);

	return  `${baseUrl}/compare/${name}?title=${title}`;
	// return `${baseUrl}/compare/${name}`;
}
 

// BRANCH 
// `${repository.html_url}/pull/new/${ref}`,
// BRANCH SYNC
// `${repository.html_url}/pull/new/${branch.name}`,