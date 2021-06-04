import url from "url";

import crypto from "crypto";
import { Action, ActionType } from "../../src/proto/v0/action";
import nock from "nock";


describe("Hydro Gateway Protobuf Submissions", () => {
  let parsedURL;
  let basePath;
  let origDisabledState;
  let setIsDisabled;
  let statsd;
  let submitProto;

  beforeEach(async () => {
    const tracking = await import('../../src/tracking');
    parsedURL = url.parse(tracking.BaseURL);
    basePath = parsedURL.href.replace(parsedURL.path, '');
    origDisabledState = tracking.isDisabled();
    setIsDisabled = tracking.setIsDisabled;
    submitProto = tracking.submitProto;
    setIsDisabled(false);
    statsd = (await import('../../src/config/statsd')).default;
    statsd.mockBuffer = [];
  });

  afterEach(() => {
    setIsDisabled(origDisabledState);
  });

  test.each([
    [200, true, 'OK'],
    [400, false, 'clientID Missing'],
    [404, false, 'Unknown schema'],
    [422, false, 'Invalid Payload'],
  ])(
    'Protobuf submission status=%i expected=%p',
    async (status, expected, errMsg) => {
      const e = new Action();
      e.type = ActionType.CREATED;
      nock(basePath)
        .post(parsedURL.path)
        .reply(status, function (_: string, requestBody) {
          expect(this.req.headers['x-hydro-app']).toBe('jira-integration');
          const hmac = crypto.createHmac(
            'sha256',
            process.env.HYDRO_APP_SECRET,
          );
          hmac.update(JSON.stringify(requestBody));
          expect(this.req.headers.authorization).toBe(
            `Hydro ${hmac.digest('hex')}`,
          );
          return errMsg;
        });
      expect(await submitProto(e)).toBe(expected);
      // There will be a .dist.post and a .submission metric
      expect(statsd.mockBuffer.length).toBe(2);
    },
  );

  it('Multiple protobuf submission', async () => {
    const protos = [new Action(), new Action(), new Action()];
    protos.forEach((proto) => {
      proto.type = ActionType.CREATED;
    });
    nock(basePath)
      .post(parsedURL.path)
      .reply(200, function (_: string, requestBody) {
        expect(this.req.headers['x-hydro-app']).toBe('jira-integration');
        const hmac = crypto.createHmac('sha256', process.env.HYDRO_APP_SECRET);
        hmac.update(JSON.stringify(requestBody));
        expect(this.req.headers.authorization).toBe(
          `Hydro ${hmac.digest('hex')}`,
        );
        return 'OK';
      });
    expect(await submitProto(protos)).toBe(true);
    // There will be a .dist.post and a .submission metric
    expect(statsd.mockBuffer.length).toBe(2);
    expect(statsd.mockBuffer[1]).toBe(
      'jira-integration.hydro.submission:3|c|#env:test,schema:jira.v0.Action,status:200',
    );
  });

  /**
   * This would fail if we didn't have the right secret in place
   */
  it('Returns true when disabled', async () => {
    setIsDisabled(true);
    const e = new Action();
    e.type = ActionType.CREATED;
    expect(await submitProto(e)).toBe(true);
    expect(statsd.mockBuffer.length).toBe(0);
  });
});
