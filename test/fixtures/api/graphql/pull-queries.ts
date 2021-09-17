const query = `query ($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo){
      pullRequests(first: 100, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {
        edges {
          cursor
          node {
            author {
              avatarUrl
              login
              url
            }
            databaseId
            repository {
              url
            }
            baseRef {
              name
            }
            headRef {
              name
            }
            number
            state
            title
            body
            updatedAt
            url
          }
        }
      }
    }
  }`;

export const pullsNoLastCursor = {
	query,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
	}
};

export const pullsWithLastCursor = {
	query,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		cursor: "Y3Vyc29yOnYyOpK5MjAxOC0wOC0yM1QxNzozODowNS0wNDowMM4MjT7J"
	}
};
