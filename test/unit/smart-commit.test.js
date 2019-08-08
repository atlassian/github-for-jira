const smartCommit = require('../../lib/transforms/smart-commit')

describe('Smart commit parsing', () => {
  it('should parse a smart commit', () => {
    const text = 'JRA-090 #resolve Finally finished'

    const result = smartCommit(text)

    expect(result).toEqual({
      issueKeys: ['JRA-090']
    })
  })

  describe('Commands', () => {
    it('should parse a command', () => {
      const text = 'JRA-123 #development'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-123']
      })
    })

    it('should parse multiple commands in a row', () => {
      const text = 'JRA-123 #comment This is a comment #start-development #time 4m'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-123']
      })
    })

    it('should parse a #comment command', () => {
      const text = 'JRA-123 #comment This is a comment'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-123']
      })
    })

    describe('#time', () => {
      it('should parse a #time command', () => {
        const text = 'JRA-123 #time 1w 2d 3h 4m'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should parse a #time command with a comment', () => {
        const text = 'JRA-123 #time 1w 2d 3h 4m This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should parse time units in any order', () => {
        const text = 'JRA-123 #time 1h 2m 3w 4d This is a different comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should not parse invalid time units', () => {
        const text = 'JRA-123 #time 1q This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })
    })

    describe('#transition', () => {
      it('should parse a transition command', () => {
        const text = 'JRA-123 #resolve'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should parse a transition command with a hyphen', () => {
        const text = 'JRA-123 #start-development'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should parse a transition command with a comment', () => {
        const text = 'JRA-123 #resolve This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })

      it('should parse a transition command with a comment and a hyphen', () => {
        const text = 'JRA-123 #start-development This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          issueKeys: ['JRA-123']
        })
      })
    })
  })

  describe('Issue keys', () => {
    it('should parse an issue key', () => {
      const text = 'JRA-090'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-090']
      })
    })

    it('should not parse an issue key with an underscore and numbers', () => {
      const text = 'J_1993A-090 J_1993A-090'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: undefined
      })
    })

    it('should not parse an issue key that starts with an underscore and numbers', () => {
      const text = '_1993A-090 1993A-090'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: undefined
      })
    })

    it('should parse multiple issue keys', () => {
      const text = 'JRA-090-JRA-091 JRA-092-JRA-093, JRA-094, branchname.JRA-095, branchname_JRA-096, [DEV-4189][DEV-4191] <JRA-123>'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-090', 'JRA-091', 'JRA-092', 'JRA-093', 'JRA-094', 'JRA-095', 'JRA-096', 'DEV-4189', 'DEV-4191', 'JRA-123']
      })
    })

    it('should ignore issue keys in a command comment', () => {
      const text = 'JRA-090 #comment JRA-091 #transition JRA-092'

      const result = smartCommit(text)

      expect(result).toEqual({
        issueKeys: ['JRA-090']
      })
    })
  })

  it('should ignore irrelevant text', () => {
    const text = 'Ignored text JRA-090 JRA-091 JRA-092 ignored text'

    const result = smartCommit(text)

    expect(result).toEqual({
      issueKeys: ['JRA-090', 'JRA-091', 'JRA-092']
    })
  })
})
