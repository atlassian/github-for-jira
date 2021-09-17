const query = `query ($owner: String!, $repo: String!, $cursor: String) {    repository(owner: $owner, name: $repo) {
      refs(first: 100, refPrefix: "refs/heads/", after: $cursor) {
        edges {
          cursor
          node {
            associatedPullRequests(first:1) {
              nodes {
                title
              }
            }
            name
            target {
              ... on Commit {
                author {
                  avatarUrl
                  email
                  name
                }
                authoredDate
                history(first: 100) {
                  nodes {
                    message
                    oid
                    authoredDate
                    author {
                      avatarUrl
                      email
                      name
                      user {
                        url
                      }
                    }
                    url
                  }
                }
                oid
                message
                url
              }
            }
          }
        }
      }
    }
  }`;

export const branchesNoLastCursor = {
	query,
	variables: { owner: "integrations", repo: "test-repo-name"}
};

export const branchesWithLastCursor = {
	query,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		cursor: "MQ"
	}
};
