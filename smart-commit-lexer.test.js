const SmartCommitLexer = require('./smart-commit-lexer.js')

const lex = function (source) {
  const lexer = SmartCommitLexer()
  lexer.reset(source)
  return Array.from(lexer)
}

const valuesForType = function (tokens, type) {
  return tokens.filter(token => token.type === type).map(token => token.value)
}

describe('SmartCommitsLexer', () => {
  describe('issue keys', () => {
    it('extracts a single issue key', () => {
      const tokens = lex('JRA-123')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123'])
    })

    it('extracts multiple issue keys', () => {
      const tokens = lex('JRA-123 JRA-456')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123', 'JRA-456'])
    })

    it('extracts lowercase issue keys', () => {
      const tokens = lex('jra-123')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['jra-123'])
    })

    it('extracts issue keys embedded in branch names', () => {
      const tokens = lex('feature/jra-123-my-feature')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['jra-123'])
    })

    it('extracts issue keys prefixed with a hash', () => {
      const tokens = lex('#JRA-123 [#JRA-456]')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123', 'JRA-456'])
    })

    it('extracts issue key surrounded by other text', () => {
      const tokens = lex('there is some text here JRA-123 and some text here')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123'])
    })

    it('does not extract issue key that contain underscores', () => {
      const tokens = lex('J_1993A-090 J_1993A-090')

      expect(valuesForType(tokens, 'issueKey')).toEqual([])
    })

    it('does not extract issue key that start with underscores or numbers', () => {
      const tokens = lex('_1993A-090 1993A-090')

      expect(valuesForType(tokens, 'issueKey')).toEqual([])
    })

    it('extracts issue keys from branch names', () => {
      const tokens = lex('branchname_JRA-096 feature/lief-12155-test-jira')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-096', 'lief-12155'])
    })
  })

  describe('transitions', () => {
    it('extracts issue key and comment text', () => {
      const tokens = lex('JRA-34 #comment corrected indent issue')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-34'])
      expect(valuesForType(tokens, 'comment')).toEqual(['corrected indent issue'])
    })

    it('extracts issue key, transition, and comment text', () => {
      const tokens = lex('JRA-090 #close Fixed this today')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-090'])
      expect(valuesForType(tokens, 'comment')).toEqual(['Fixed this today'])
      expect(valuesForType(tokens, 'transition')).toEqual(['close'])
    })

    it('extracts transition containing hyphen', () => {
      const tokens = lex('JRA-090 #finish-work Fixed this today')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-090'])
      expect(valuesForType(tokens, 'comment')).toEqual(['Fixed this today'])
      expect(valuesForType(tokens, 'transition')).toEqual(['finish-work'])
    })

    it('ignores issue keys within a comment', () => {
      const tokens = lex('JRA-123 #comment This is related to JRA-456')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123'])
      expect(valuesForType(tokens, 'comment')).toEqual(['This is related to JRA-456'])
    })

    it('exctracts transition without issue or comment', () => {
      const tokens = lex('#development')

      expect(valuesForType(tokens, 'transition')).toEqual(['development'])
    })
  })

  describe('time', () => {
    it('extracts issue key and time', () => {
      const tokens = lex('JRA-34 #time 1w 2d')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-34'])
      expect(valuesForType(tokens, 'weeks')).toEqual(['1'])
      expect(valuesForType(tokens, 'days')).toEqual(['2'])
    })

    it('extracts issue key, time, and work log comment text', () => {
      const tokens = lex('JRA-34 #time 1w 2d 4h 30m Total work logged')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-34'])
      expect(valuesForType(tokens, 'weeks')).toEqual(['1'])
      expect(valuesForType(tokens, 'days')).toEqual(['2'])
      expect(valuesForType(tokens, 'hours')).toEqual(['4'])
      expect(valuesForType(tokens, 'minutes')).toEqual(['30'])
      expect(valuesForType(tokens, 'workLogComment')).toEqual(['Total work logged'])
    })

    it('extracts decimal times', () => {
      const tokens = lex('JRA-34 #time 1.11w 2.22d 4.44h 3.33m')

      expect(valuesForType(tokens, 'weeks')).toEqual(['1.11'])
      expect(valuesForType(tokens, 'days')).toEqual(['2.22'])
      expect(valuesForType(tokens, 'hours')).toEqual(['4.44'])
      expect(valuesForType(tokens, 'minutes')).toEqual(['3.33'])
    })
  })

  describe('advanced', () => {
    it('extracts multiple issues with time, comment, and a transition', () => {
      const tokens = lex('JRA-123 JRA-234 JRA-345 #resolve #time 2d 5h #comment ahead of schedule')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['JRA-123', 'JRA-234', 'JRA-345'])
      expect(valuesForType(tokens, 'transition')).toEqual(['resolve', 'comment'])
      expect(valuesForType(tokens, 'days')).toEqual(['2'])
      expect(valuesForType(tokens, 'hours')).toEqual(['5'])
      expect(valuesForType(tokens, 'comment')).toEqual(['ahead of schedule'])
    })

    it('extracts multiple issues with time, comment, and a transition', () => {
      const tokens = lex('#comment This is a comment #start-development #time 4m')

      expect(valuesForType(tokens, 'issueKey')).toEqual([])
      expect(valuesForType(tokens, 'transition')).toEqual(['comment', 'start-development'])
      expect(valuesForType(tokens, 'minutes')).toEqual(['4'])
      expect(valuesForType(tokens, 'comment')).toEqual(['This is a comment'])
    })

    it('is flexible', () => {
      const tokens = lex('[TEST-123] body of the test pull request.\n')

      expect(valuesForType(tokens, 'issueKey')).toEqual(['TEST-123'])
    })
  })
})
