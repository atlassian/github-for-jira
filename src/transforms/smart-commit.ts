import SmartCommitTokenizer from '../smart-commit-tokenizer';

export default (source) => {
  const tokenizer = SmartCommitTokenizer();
  tokenizer.reset(source);
  const issueKeys = [];

  for (const token of tokenizer) {
    if (token.type === 'issueKey') {
      issueKeys.push(token.value);
    }
  }
  return issueKeys.length > 0 ? {issueKeys} : {};
};
