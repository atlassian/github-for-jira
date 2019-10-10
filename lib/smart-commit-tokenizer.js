const moo = require('moo')

// RDVCS Connector regexp provided by Atlassian
const punct = '!"\\#$%&\'()*+,\\-./:;<=>?@\\[\\\\\\]^_`{|}~'
const issueKeysRegex = new RegExp(`(?:(?<=[\\s${punct}])|^)(?:[A-Z][A-Z\\d]+-\\d+)(?:(?=[\\s${punct}])|$)`)

module.exports = function () {
  const transition = { match: /(?<= )#[a-z-]+?(?:(?= )|$)/, value: text => text.slice(1), push: 'transition' }
  const carriageReturn = {match: /\r/}
  const newline = {match: /\n/, lineBreaks: true, next: 'main'}
  const time = {match: /(?<= )#time(?= )/, push: 'workLog'}
  // Match whitespace characters except \r and \n, which are used to delimit commands
  const whitespace = /[^\S\r\n]+/
  const notWhitespace = /\S+/

  return moo.states({
    main: {
      issueKey: issueKeysRegex,
      time,
      transition,
      whitespace,
      // Non-greedy so `foo-JRA-123` extracts issue key JRA-123
      ignoredText: /\S+?/,
      carriageReturn,
      newline
    },
    transition: {
      time,
      transition,
      comment: notWhitespace,
      whitespace,
      carriageReturn,
      newline
    },
    workLog: {
      transition,
      weeks: {match: /[\d.]+?w(?!\B)/, value: text => text.slice(0, -1)},
      days: {match: /[\d.]+?d(?!\B)/, value: text => text.slice(0, -1)},
      hours: {match: /[\d.]+?h(?!\B)/, value: text => text.slice(0, -1)},
      minutes: {match: /[\d.]+?m(?!\B)/, value: text => text.slice(0, -1)},
      whitespace,
      workLogComment: notWhitespace,
      carriageReturn,
      newline
    }
  })
}
