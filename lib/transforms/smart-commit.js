const SmartCommitLexer = require('../../smart-commit-lexer.js')

const valuesForType = function (tokens, type) {
  return tokens.filter(token => token.type == type).map(token => token.value)
}

module.exports = (source) => {
  const lexer = SmartCommitLexer()
  lexer.reset(source)
  const tokens = Array.from(lexer)

  const issueKeys = []
  const commands = []
  let command = null
  const states = ['main']
  const currentState = () => states[states.length - 1]

  const transition = {
    action (token) {
      if (token.value == 'comment') {
        command = { kind: 'comment' }
      } else {
        command = { name: token.value, kind: 'transition' }
      }

      if (issueKeys.length > 0) {
        command.issueKeys = issueKeys
      }
      commands.push(command)
    },
    push: 'transition'
  }
  const time = {
    action (token) {
      command = {kind: 'worklog', time: 0}

      if (issueKeys.length > 0) {
        command.issueKeys = issueKeys
      }
      commands.push(command)
    },
    push: 'time'
  }

  rulesByState = {
    main: {
      issueKey: {action: (token) => issueKeys.push(token.value)},
      transition,
      time
    },
    transition: {
      transition,
      time,
      comment: {action: (token) => command.text = token.value, pop: true}
    },
    time: {
      transition,
      minutes: { action: (token) => command.time = command.time + parseFloat(token.value) * 60},
      hours: { action: (token) => command.time = command.time + parseFloat(token.value) * 60 * 60},
      days: { action: (token) => command.time = command.time + parseFloat(token.value) * 60 * 60 * 24},
      weeks: { action: (token) => command.time = command.time + parseFloat(token.value) * 60 * 60 * 24 * 7 },
      workLogComment: { action: (token) => command.text = token.value, pop: true }
    }
  }

  tokens.forEach(function (token) {
    rules = rulesByState[currentState()]
    rule = rules[token.type]

    if (rule) {
      rule.action(token)

      if (rule.pop) {
        states.pop()
      } else if (rule.push) {
        states.push(rule.push)
      }
    }
  })

  const data = {issueKeys: undefined, commands}
  if (issueKeys.length > 0) {
    data.issueKeys = issueKeys
  }

  return data
}
