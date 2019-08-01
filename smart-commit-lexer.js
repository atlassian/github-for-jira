const moo = require('moo');

// RDVCS Connector regexp provided by Atlassian
const punct = '!"\\#$%&\'()*+,\\-./:;<=>?@\\[\\\\\\]^_`{|}~'
const issueKeysRegex = new RegExp(`(?:(?<=[\\s${punct}])|^)(?:[a-zA-Z][a-zA-Z\\d]+-\\d+)(?:(?=[\\s${punct}])|$)`)

module.exports = function() {
  const transition = {match: /#[a-z-]+?(?: |$)/, value: text => text.slice(1).trimRight(), push: 'transition'};

  return moo.states({
    main: {
      whitespace: /[ \t]+/,
      issueKey: issueKeysRegex,
      time: {match: '#time ', push: 'workLog'},
      transition,
      ignoredText: /[^\s]+?/,
    },
    transition: {
      time: {match: '#time ', push: 'workLog'},
      transition,
      comment: {match: /[^#\n]+/, value: text => text.trim()}
    },
    workLog: {
      transition,
      weeks:   {match: /[\d\.]+?w(?!\B)/, value: text => text.slice(0, -1)},
      days:    {match: /[\d\.]+?d(?!\B)/, value: text => text.slice(0, -1)},
      hours:   {match: /[\d\.]+?h(?!\B)/, value: text => text.slice(0, -1)},
      minutes: {match: /[\d\.]+?m(?!\B)/, value: text => text.slice(0, -1)},
      whitespace: /[ \t]+/,
      workLogComment: /.+/
    }
  });
};
