import { Repository } from "@octokit/graphql-schema";

export const ViewerRepositoryCountQuery = `
query {
	viewer {
		repositories {
			totalCount
		}
	}
}`;

type RepositoryNode = {
  node: Repository
}

export type GetRepositoriesResponse = {
  viewer: {
    repositories: {
      pageInfo,
      edges: RepositoryNode[]
    }
  }
};

export const GetRepositoriesQuery = `query ($per_page: Int!, $cursor: String) {
  viewer {
    repositories(first: $per_page, after: $cursor) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id: databaseId
          name
          full_name: nameWithOwner
          owner {
            login
          }
          html_url: url
          updated_at: updatedAt
        }
      }
    }
  }
}`;

export const getPullRequests = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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

export type getCommitsResponse = {
  repository: {
    defaultBranchRef: {
      target: {
        history: {
          edges
        }
      }
    }
  }
};

export const getCommitsQuery = (includeChangedFiles?: boolean) => `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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
                  ${includeChangedFiles ? "changedFiles" : ""}
                }
              }
            }
          }
        }
      }
    }
  }`;

export const getCommitsQueryOctoKit = (includeChangedFiles?: boolean) => `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String, $default_ref: String!) {
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
                  ${includeChangedFiles ? "changedFiles" : ""}
                }
              }
            }
          }
        }
      }
    }
  }`;

export type GetBranchesResponse = {repository: Repository};
export const GetBranchesQuery = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
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
                changedFiles
                history(first: 50) {
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

export type getDefaultRefResponse = {
  repository: {
    defaultBranchRef: {
      name: string
    }
  }
};

export const getDefaultRef = `query ($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
        }
    }
  }`;
