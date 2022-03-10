const query = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    defaultBranchRef {
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
                changedFiles
              }
            }
          }
        }
      }
    }
  }
}`;

const queryOctoKit = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String, $default_ref: String!) {
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
                changedFiles
              }
            }
          }
        }
      }
    }
  }
}`;


export const commitsNoLastCursorOctokit = (variables) => ({
	query: queryOctoKit,
	variables
});

export const commitsNoLastCursor = (variables) => ({
	query,
	variables
});

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
