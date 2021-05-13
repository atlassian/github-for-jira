const fs = require('fs');
const path = require('path');
const getJiraUtil = require('../../../lib/jira/util');
const { getJiraId } = require('../../../lib/jira/util/id');

describe('Jira util', () => {
  function loadFixture(name) {
    const base = path.join(__dirname, '../../fixtures/text', name);
    const source = fs.readFileSync(`${base}.source.md`).toString('utf-8').trim();
    const rendered = fs.readFileSync(`${base}.rendered.md`).toString('utf-8').trim();
    return { source, rendered };
  }

  describe('#addJiraIssueLinks', () => {
    let util;
    let jiraClient;

    beforeEach(() => {
      jiraClient = {
        baseURL: 'http://example.com',
        issues: td.object(['get']),
      };

      util = getJiraUtil(jiraClient);
    });

    it('it should handle multiple Jira references appropriately', () => {
      const { source, rendered } = loadFixture('multiple-links');
      const issues = [
        {
          key: 'TEST-2019',
          fields: {
            summary: 'First Issue',
          },
        },
        {
          key: 'TEST-2020',
          fields: {
            summary: 'Second Issue',
          },
        },
        {
          key: 'TEST-2021',
          fields: {
            summary: 'Third Issue',
          },
        },
      ];

      const result = util.addJiraIssueLinks(source, issues);
      expect(result).toBe(rendered);
    });

    it('should linkify Jira references to valid issues', () => {
      const { source, rendered } = loadFixture('existing-reference-link');
      const issues = [
        {
          key: 'TEST-2019',
          fields: {
            summary: 'Example Issue',
          },
        },
      ];

      const result = util.addJiraIssueLinks(source, issues);
      expect(result).toBe(rendered);
    });

    it('should not add reference links if already present', () => {
      const { source, rendered } = loadFixture('previously-referenced');
      const issues = [
        {
          key: 'TEST-2019',
          fields: {
            summary: 'Example Issue',
          },
        },
      ];
      const result = util.addJiraIssueLinks(source, issues);
      expect(result).toBe(rendered);
    });

    it('should not linkify Jira references to invalid issues', () => {
      const text = 'Should not linkify [TEST-123] as a link';
      const issues = [];

      const result = util.addJiraIssueLinks(text, issues);

      expect(result).toBe('Should not linkify [TEST-123] as a link');
    });

    it('should linkify only Jira references to valid issues', () => {
      const { source, rendered } = loadFixture('valid-and-invalid-issues');
      const issues = [
        {
          key: 'TEST-200',
          fields: {
            summary: 'Another Example Issue',
          },
        },
      ];

      const result = util.addJiraIssueLinks(source, issues);
      expect(result).toBe(rendered);
    });

    it('should only pull issue keys from reference links', () => {
      const { source, rendered } = loadFixture('find-existing-references');
      const issues = [
        {
          key: 'TEST-2019',
          fields: {
            summary: 'First Issue',
          },
        },
        {
          key: 'TEST-2020',
          fields: {
            summary: 'Second Issue',
          },
        },
        {
          key: 'TEST-2021',
          fields: {
            summary: 'Third Issue',
          },
        },
      ];

      const result = util.addJiraIssueLinks(source, issues);

      expect(result).toBe(rendered);
    });
  });

  describe('#getJiraId', () => {
    expect(getJiraId('AP-3-large_push')).toEqual('AP-3-large_push');
    expect(getJiraId('AP-3-large_push/foobar')).toEqual('~41502d332d6c617267655f707573682f666f6f626172');
    expect(getJiraId('feature-something-cool')).toEqual('feature-something-cool');
    expect(getJiraId('feature/something-cool')).toEqual('~666561747572652f736f6d657468696e672d636f6f6c');
  });
});
