export const query = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    deployments(first: $per_page, after: $cursor) {
      edges {
        cursor
        node {
          repository {
            name
            owner {
              login
            }
          }
          databaseId
          commitOid
          task
          ref {
            name
            id
          }
          environment
          description
          latestStatus {
            environmentUrl
            logUrl
            state
            id
            updatedAt
          }
        }
      }
    }
  }
}`;

export const deploymentsNoLastCursor = (variables) => ({
	query,
	variables
});

export const deploymentsWithLastCursor = {
	query,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		per_page: 20,
		cursor: "Y3Vyc29yOnYyOpK5MjAxsdlkwOC0yM1QxNzozODowNS0wNDowMM4MjT7J 99"
	}
};