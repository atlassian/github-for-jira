const query = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo){
      pullRequests(first: $per_page, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {
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
  variables: { owner: "integrations", repo: "test-repo-name", per_page: 20 }
};

export const pullsWithLastCursor = {
  query,
  variables: {
    owner: "integrations",
    repo: "test-repo-name",
    per_page: 20,
    cursor: "Y3Vyc29yOnYyOpK5MjAxOC0wOC0yM1QxNzozODowNS0wNDowMM4MjT7J"
  }
};
