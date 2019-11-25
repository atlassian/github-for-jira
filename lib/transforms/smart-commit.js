const SmartCommitTokenizer = require('../smart-commit-tokenizer.js');

module.exports = (source) => {
  const tokenizer = SmartCommitTokenizer();
  tokenizer.reset(source);
  const issueKeys = [];

  tokenizer.forEach((token) => {
    if (token.type === 'issueKey') {
      issueKeys.push(token.value);
    }
  });

  if (issueKeys.length > 0) {
    return { issueKeys };
  } else {
    return {};
  }
};
