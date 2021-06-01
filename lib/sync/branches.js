const transformBranches = require('./transforms/branch');
const { getBranches: getBranchesQuery } = require('./queries');

exports.getBranches = async (github, repository, cursor, perPage) => {
  try {
    const { edges } = (await github.graphql(getBranchesQuery, {
      owner: repository.owner.login,
      repo: repository.name,
      per_page: perPage,
      cursor,
    })).repository.refs;

    const branches = edges.map(({ node: item }) => {
      // translating the object into a schema that matches our transforms
      const associatedPullRequestTitle = (item.associatedPullRequests.nodes.length > 0)
        ? item.associatedPullRequests.nodes[0].title
        : '';
      return {
        name: item.name,
        associatedPullRequestTitle,
        commits: item.target.history.nodes,
        lastCommit: {
          author: item.target.author,
          authorTimestamp: item.target.authoredDate,
          fileCount: 0,
          sha: item.target.oid,
          message: item.target.message,
          url: item.target.url,
        },
      };
    });

    const { data: jiraPayload } = transformBranches({ branches, repository });
    return { edges, jiraPayload };
  } catch (err) {
    logger.error(`Error syncing branches: ${err}`);
  }
};
