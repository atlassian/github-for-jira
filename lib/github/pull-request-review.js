const transformPullRequestReview = require('../transforms/pull-request-review')

module.exports = async (context, jiraClient, util) => {
  console.log(context.payload)

  const author = await context.github.users.getForUser({ username: context.payload.pull_request.user.login })
  const { action: action, review: review, issues: issueKeys, data: jiraPayload } = transformPullRequestReview(context.payload, author.data)
  const { pull_request: pullRequest } = context.payload

  if (!jiraPayload) {
    return
  }

  if ( action === 'submitted' && review['state'] === 'approved' ) {
    const commentPayload = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Pull Request ',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: review['html_url'],
                      title: 'Pull Request Review'
                    }
                  }
                ]
              },
              {
                type: 'text',
                text: 'Approved by '
              },
              {
                type: 'text',
                text: review['user']['login'],
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: review['user']['html_url'],
                      title: 'Pull Request Review'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }

    for (const issue of issueKeys) {
      await jiraClient.issues.comments.addForIssue(issue, commentPayload)
    }
  }

}