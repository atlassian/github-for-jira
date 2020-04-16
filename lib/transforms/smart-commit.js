const SmartCommitTokenizer = require('../smart-commit-tokenizer.js');

module.exports = (source) => {
  const tokenizer = SmartCommitTokenizer();
  tokenizer.reset(source);
  const issueKeys = [];

  for (const token of tokenizer) {
    if (token.type === 'issueKey') {
      issueKeys.push(token.value);
    }
  }

  if (issueKeys.length > 0) {
    return { issueKeys };
  } else {
    return {};
  }
};
