const subdomainRegexp = /^\w(?:[\w-]{0,61}\w)?$/
const jiraDomains = ['atlassian.net', 'jira.com']

function validJiraDomains (jiraSubdomain, jiraDomain) {
  return jiraSubdomain &&
    jiraDomains.includes(jiraDomain) &&
    subdomainRegexp.test(jiraSubdomain)
}

function jiraDomainOptions (jiraDomain) {
  return jiraDomains.map(value => ({ value, selected: value === jiraDomain }))
}

module.exports = {
  validJiraDomains,
  jiraDomainOptions
}
