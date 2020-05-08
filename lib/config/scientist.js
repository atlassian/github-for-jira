const Scientist = require('scientist');

const statsd = require('./statsd');

const statName = 'scientist.experiment';
const scientist = new Scientist();

let scienceConfig = {};
if (process.env.SCIENCE_CONFIG) {
  scienceConfig = JSON.parse(process.env.SCIENCE_CONFIG);
}

/**
 * Type information taken from the trello/scientist module
 *
 * Docs available {@link https://github.com/trello/scientist/blob/master/docs/api.md}
 *
 * @typedef {object} Experiment
 * @property {string} name - The name of this experiment
 */

/**
 * @typedef {object} Observation
 * @property {string} name - The name of this observation (control, candidate, etc)
 * @property {any} value - The result of the experiment
 * @property {any} [error] - Information about an error that occurred.
 * @property {Date} startTime - The time that the experiment started
 * @property {number} duration - How long this experiment took in ms
 * @property {function(): string} inspect - Returns a string representation of the cleaned value or error for printing or logging.
 */

/**
 * @typedef {object} Result
 * @property {Experiment} experiment - Information about this experiment.
 * @property {function(): boolean} didReturn - Returns true if the block returned or resolved, false if the block threw or rejected.
 * @property {any} context - Shared object for metadata about the experiment.
 * @property {Observation} control - The original method/way of doing things
 * @property {Array<Observation>} candidates
 * @property {Array<Observation>} ignored
 * @property {Array<Observation>} matched - Experiments that had an output the same as the control.
 * @property {Array<Observation>} mismatched - Experiments that had an output different from the control.
 */

/**
 * Generate a list of tags for an experiment.
 *
 * @param {Experiment} experiment - The experiment.
 * @param {Array<string>} extra - Extra tags.
 * @returns {Array<string>} The tags.
 */
function makeExpTags(experiment, ...extra) {
  return [`experiment:${experiment.name}`].concat(extra);
}

scientist.sample(
  /**
   * Determine if we should run this experiment or skip it.
   *
   * @param {string} experimentName - The name of the experiment
   */
  (experimentName) => {
    if (experimentName in scienceConfig) {
      // Configuration maps a name to a percentage
      return Math.random() < scienceConfig[experimentName];
    } else {
      // Default to not running for safety
      return false;
    }
  },
);

scientist.on('skip',
  /**
   * Emit a stat for when we skip an experiment.
   *
   * @param {Experiment} experiment - The skipped Experiment */
  (experiment) => {
    statsd.increment(`${statName}.count`, makeExpTags(experiment, 'status:skipped'));
  });

scientist.on('result',
  /**
   * Emit stats for the experiments.
   *
   * @param {Result} result - The result of this experiment. */
  (result) => {
    statsd.timing(statName, result.control.duration, makeExpTags(result.experiment, 'status:control'));
    result.matched.forEach((match) => {
      statsd.timing(statName, match.duration, makeExpTags(result.experiment, 'status:match'));
    });
    result.mismatched.forEach((match) => {
      const tags = makeExpTags(result.experiment, 'status:mismatch');
      if (match.error) tags.push('has_error');
      statsd.timing(statName, match.duration, tags);
    });
  });

module.exports = scientist.science.bind(scientist);
