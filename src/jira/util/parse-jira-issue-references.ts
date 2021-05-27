const jiraIssueRegex = /[A-Z]+-[0-9]+/g;
export default (text:string) => text.match(jiraIssueRegex);
