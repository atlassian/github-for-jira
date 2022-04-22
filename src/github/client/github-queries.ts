import { Repository } from "models/subscription";

export const ViewerRepositoryCountQuery = `
query {
	viewer {
		repositories {
			totalCount
		}
	}
}`;

interface RepositoryNode {
	node: Repository
}

export interface GetRepositoriesResponse {
	viewer: {
		repositories: {
			pageInfo: {
				endCursor: string;
				hasNextPage: boolean;
			};
			edges: RepositoryNode[];
		}
	}
}

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

export type CommitQueryNode = {
	cursor: string,
	node: {
		author: {
			avatarUrl: string,
			email: string,
			name: string,
			user: { url: string }
		},
		authoredDate: Date,
		message: string,
		oid: string,
		url: string,
		changedFiles?: number
	}
}

export type getCommitsResponse = {
	repository: {
		defaultBranchRef: {
			target: {
				history: {
					edges: CommitQueryNode[]
				}
			}
		}
	}
};

export const getCommitsQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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

export const getCommitsQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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
              }
            }
          }
        }
      }
    }
  }
  }`;

export type getBranchesResponse = { repository: Repository };
export const getBranchesQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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

export const getBranchesQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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
