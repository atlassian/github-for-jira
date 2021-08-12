const query = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String, $default_ref: String!) {
    repository(owner: $owner, name: $repo){
      ref(qualifiedName: $default_ref) {
        target {
          ... on Commit {
            history(first: $per_page, after: $cursor) {
              edges {
                cursor
                node {
                  author {
                    avatarUrl
                    email
                    name
                    user {
                      url
                    }
                  }
                  authoredDate
                  message
                  oid
                  url
                }
              }
            }
          }
        }
      }
    }
  }`;

export const commitsNoLastCursor = {
	query,
	variables: {
		owner: "integrations", repo: "test-repo-name", per_page: 20, default_ref: "master"
	}
};

export const commitsWithLastCursor = {
	query,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		per_page: 20,
		cursor: "Y3Vyc29yOnYyOpK5MjAxsdlkwOC0yM1QxNzozODowNS0wNDowMM4MjT7J 99",
		default_ref: "master"
	}
};

const defaultBranchQuery = `query ($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
        }
    }
  }`;

export const getDefaultBranch = {
	query: defaultBranchQuery,
	variables: {
		owner: "integrations",
		repo: "test-repo-name"
	}
};
