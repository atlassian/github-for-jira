const validJiraId = /^[a-zA-Z0-9~.\-_]+$/
function getJiraId (name) {
  return validJiraId.test(name) ? name : '~' + Buffer.from(name).toString('hex')
}

exports.getJiraId = getJiraId
