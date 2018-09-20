const smartCommit = require('../../lib/transforms/smart-commit')

describe('Smart commit parsing', () => {
  it('should parse a smart commit', () => {
    const text = 'JRA-090 #resolve Finally finished'

    const result = smartCommit(text)

    expect(result).toEqual({
      commands: [
        {
          kind: 'transition',
          name: 'resolve',
          text: 'Finally finished',
          issueKeys: ['JRA-090']
        }
      ],
      issueKeys: ['JRA-090']
    })
  })

  describe('Commands', () => {
    it('should parse a command', () => {
      const text = '#development'

      const result = smartCommit(text)

      expect(result).toEqual({
        commands: [
          {
            kind: 'transition',
            name: 'development'
          }
        ]
      })
    })

    it('should parse multiple commands in a row', () => {
      const text = '#comment This is a comment #start-development #time 4m'

      const result = smartCommit(text)

      expect(result).toEqual({
        commands: [
          {
            kind: 'comment',
            text: 'This is a comment'
          },
          {
            kind: 'transition',
            name: 'start-development'
          },
          {
            kind: 'worklog',
            time: 240
          }
        ]
      })
    })

    it('should parse a #comment command', () => {
      const text = '#comment This is a comment'

      const result = smartCommit(text)

      expect(result).toEqual({
        commands: [
          {
            kind: 'comment',
            text: 'This is a comment'
          }
        ]
      })
    })

    describe('#time', () => {
      it('should parse a #time command', () => {
        const text = '#time 1w 2d 3h 4m'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'worklog',
              time: 604800 + 172800 + 10800 + 240
            }
          ]
        })
      })

      it('should parse a #time command with a comment', () => {
        const text = '#time 1w 2d 3h 4m This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'worklog',
              time: 604800 + 172800 + 10800 + 240,
              text: 'This is a comment'
            }
          ]
        })
      })

      it('should parse time units in any order', () => {
        const text = '#time 1h 2m 3w 4d This is a different comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'worklog',
              time: 3600 + 120 + 1814400 + 345600,
              text: 'This is a different comment'
            }
          ]
        })
      })

      it('should not parse invalid time units', () => {
        const text = '#time 1q This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'worklog',
              time: 0,
              text: '1q This is a comment'
            }
          ]
        })
      })
    })

    describe('#transition', () => {
      it('should parse a transition command', () => {
        const text = '#resolve'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'transition',
              name: 'resolve'
            }
          ]
        })
      })

      it('should parse a transition command with a hyphen', () => {
        const text = '#start-development'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'transition',
              name: 'start-development'
            }
          ]
        })
      })

      it('should parse a transition command with a comment', () => {
        const text = '#resolve This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'transition',
              name: 'resolve',
              text: 'This is a comment'
            }
          ]
        })
      })

      it('should parse a transition command with a comment and a hyphen', () => {
        const text = '#start-development This is a comment'

        const result = smartCommit(text)

        expect(result).toEqual({
          commands: [
            {
              kind: 'transition',
              name: 'start-development',
              text: 'This is a comment'
            }
          ]
        })
      })
    })
  })

  describe('Issue keys', () => {
    it('should parse an issue key', () => {
      const text = 'JRA-090'

      const result = smartCommit(text)

      expect(result).toMatchObject({
        issueKeys: ['JRA-090']
      })
    })

    it('should parse an issue key with an underscore and numbers', () => {
      const text = 'J_1993A-090'

      const result = smartCommit(text)

      expect(result).toMatchObject({
        issueKeys: ['J_1993A-090']
      })
    })

    it('should not parse an issue key that starts with an underscore and numbers', () => {
      const text = '_1993A-090 1993A-090'

      const result = smartCommit(text)

      expect(result).toMatchObject({
        issueKeys: undefined
      })
    })

    it('should parse multiple issue keys', () => {
      const text = 'JRA-090 JRA-091 JRA-092-JRA-093, JRA-094'

      const result = smartCommit(text)

      expect(result).toMatchObject({
        issueKeys: ['JRA-090', 'JRA-091', 'JRA-092', 'JRA-093', 'JRA-094']
      })
    })

    it('should ignore issue keys in a command comment', () => {
      const text = 'JRA-090 #comment JRA-091 #transition JRA-092'

      const result = smartCommit(text)

      expect(result).toMatchObject({
        issueKeys: ['JRA-090']
      })
    })
  })

  it('should ignore irrelevant text', () => {
    const text = 'Ignored text JRA-090 JRA-091 JRA-092 ignored text'

    const result = smartCommit(text)

    expect(result).toMatchObject({
      issueKeys: ['JRA-090', 'JRA-091', 'JRA-092']
    })
  })
})
