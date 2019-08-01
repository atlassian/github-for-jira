const moo = require('moo');

module.exports = function() {
  return moo.states({
    main: {
      whitespace:      /[ \t]+/,
      issueKey: /[a-zA-Z]+-\d+/,
      time: {match: '#time ', push: 'workLog'},
      transition: {match: /#[a-z-]+? /, value: text => text.slice(1, -1), push: 'transition'},
      ignoredText: /[^\s]+?/,
    },
    transition: {
      time: {match: '#time ', push: 'workLog'},
      comment: /.+/
    },
    workLog: {
      transition: {match: /#[a-z-]+? /, value: text => text.slice(1, -1), push: 'transition'},
      weeks:   {match: /[\d\.]+?w(?!\B)/, value: text => text.slice(0, -1)},
      days:    {match: /[\d\.]+?d(?!\B)/, value: text => text.slice(0, -1)},
      hours:   {match: /[\d\.]+?h(?!\B)/, value: text => text.slice(0, -1)},
      minutes: {match: /[\d\.]+?m(?!\B)/, value: text => text.slice(0, -1)},
      whitespace: /[ \t]+/,
      workLogComment: /.+/
    }
  });
};
