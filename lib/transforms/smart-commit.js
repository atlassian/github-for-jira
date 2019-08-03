const SmartCommitTokenizer = require('../smart-commit-tokenizer.js')

module.exports = (source) => {
  const tokenizer = SmartCommitTokenizer()
  tokenizer.reset(source)
  const tokens = Array.from(tokenizer)

  const issueKeys = []
  const commands = []
  let command = null
  const states = ['main']
  const currentState = () => states[states.length - 1]

  const transition = {
    action (token) {
      if (token.value === 'comment') {
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

  const addTime = function (token) {
    let secondsPerUnit = {
      minutes: 60,
      hours: 60 * 60,
      days: 60 * 60 * 24,
      weeks: 60 * 60 * 24 * 7
    }

    const seconds = parseFloat(token.value) * secondsPerUnit[token.type]
    command.time = command.time + seconds
  }

  const rulesByState = {
    main: {
      issueKey: {action: (token) => issueKeys.push(token.value)},
      transition,
      time
    },
    transition: {
      transition,
      time,
      comment: {action: function (token) { command.text = token.value }, pop: true}
    },
    time: {
      transition,
      minutes: {action: addTime},
      hours: {action: addTime},
      days: {action: addTime},
      weeks: {action: addTime},
      workLogComment: { action: function (token) { command.text = token.value }, pop: true }
    }
  }

  tokens.forEach(function (token) {
    const rules = rulesByState[currentState()]
    const rule = rules[token.type]

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
