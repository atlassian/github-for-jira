const query = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {    repository(owner: $owner, name: $repo) {
      refs(first: $per_page, refPrefix: "refs/heads/", after: $cursor) {
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
                history(first: $per_page) {
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
  variables: { owner: 'integrations', repo: 'test-repo-name', per_page: 50 },
};

export const branchesWithLastCursor = {
  query,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name',
    per_page: 50,
    cursor: 'MQ',
  },
};
