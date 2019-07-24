const { Project } = require('../models')
const transformPullRequest = require('../transforms/pull-request')
const reduceProjectKeys = require('../jira/util/reduce-project-keys')
const parseSmartCommit = require('../transforms/smart-commit')

module.exports = async (context, jiraClient, util) => {
  const author = await context.github.users.getForUser({ username: context.payload.pull_request.user.login })
  const { action: action, baseBranch: baseBranch, issues: issueKeys, data: jiraPayload } = transformPullRequest(context.payload, author.data)
  const { pull_request: pullRequest } = context.payload

  if (!jiraPayload && (context.payload.changes && context.payload.changes.title)) {
    const hasIssueKeys = !!parseSmartCommit(context.payload.changes.title.from)
    if (hasIssueKeys) {
      return jiraClient.devinfo.pullRequest.delete(context.payload.repository.id, pullRequest.number)
    }
  }

  const linkifiedBody = await util.unfurl(pullRequest.body)
  if (linkifiedBody) {
    const editedPullRequest = context.issue({
      body: linkifiedBody,
      id: pullRequest.id
    })
    await context.github.issues.edit(editedPullRequest)
  }

  if (!jiraPayload) {
    return
  }
  // console.log(JSON.stringify(jiraPayload))
  if (action === 'opened') {
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
                text: 'Pull Request '
              },
              {
                type: 'text',
                text: jiraPayload['name'] + ':' + jiraPayload['pullRequests'][0]['sourceBranch'],
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: jiraPayload['pullRequests'][0]['url'],
                      title: 'Pull Request'
                    }
                  }
                ]
              },
              {
                type: 'text',
                text: ' Opened by '
              },
              {
                type: 'text',
                text: jiraPayload['pullRequests'][0]['author']['name'],
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: jiraPayload['pullRequests'][0]['author']['url'],
                      title: 'Pull Request Author'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }

    // console.log('CommentPayload: ', JSON.stringify(commentPayload))

    for (const issue of issueKeys) {
      await jiraClient.issues.comments.addForIssue(issue, commentPayload)
    }
  } else if (action === 'closed') {
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
                text: 'Pull Request '
              },
              {
                type: 'text',
                text: jiraPayload['name'] + ':' + jiraPayload['pullRequests'][0]['sourceBranch'],
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: jiraPayload['pullRequests'][0]['url'],
                      title: 'Pull Request'
                    }
                  }
                ]
              },
              {
                type: 'text',
                text: jiraPayload['pullRequests'][0]['status'] === 'MERGED' ? ' Merged by ' : ' Declined by '
              },
              {
                type: 'text',
                text: jiraPayload['pullRequests'][0]['author']['name'],
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: jiraPayload['pullRequests'][0]['author']['url'],
                      title: 'Pull Request Author'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }

    // console.log('CommentPayload: ', JSON.stringify(commentPayload))

    for (const issue of issueKeys) {
      await jiraClient.issues.comments.addForIssue(issue, commentPayload)
    }

    // Update DeployedOn when it's merged to deploy branch
    if (jiraPayload['pullRequests'][0]['status'] === 'MERGED' ) {
      if (baseBranch === 'deploy') {
        // Find custom field DeployedOn
        let deployedOn = null
        const fields_raw = await jiraClient.getFields()
        const fields = fields_raw.data

        for (const field of fields) {
          if (field['name'] === 'Production Release Date') {
            deployedOn = field['id']
            break
          }
        }

        const updatePayload = {
          fields: {
            [deployedOn]: new Date().toISOString()
          }
        }
        //console.log('Update Payload: ', updatePayload)
        for (const issue of issueKeys) {
          await jiraClient.issues.update(issue,updatePayload)
        }
      }
    }
  }

  await jiraClient.devinfo.repository.update(jiraPayload)

  const projects = []
  jiraPayload.pullRequests.map(pull => reduceProjectKeys(pull, projects))
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects))

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL)
  }
}
