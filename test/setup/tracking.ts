import url from 'url';

import { setIsDisabled, BaseURL } from '../../src/tracking';

/**
 * Test that tracking works by storing a snapshot of the tracking proto sent.
 *
 * @returns {void}
 */
export default () => {
  // Enable user tracking
  const parsedURL = url.parse(BaseURL);
  const basePath = parsedURL.href.replace(parsedURL.path, '');
  setIsDisabled(false);

  // Check that we send the tracking proto
  nock(basePath)
    .post(parsedURL.path, (body) => {
      const { events } = body;
      events.forEach((event) => {
        expect(event.schema).toMatchSnapshot();
        // Parse the value so that re-ordering of serialized keys does not break tests.
        expect(JSON.parse(event.value)).toMatchSnapshot();
      });
      return true;
    })
    .reply(200, 'OK');
}
