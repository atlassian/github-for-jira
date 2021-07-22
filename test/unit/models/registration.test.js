const { Registration } = require('../../../lib/models');

describe('test registration model', () => {
  const registrationPayload = {
    githubHost: 'ghaebuild48746.ghaekubetest.net',
    state: 'adq3123131easdasd',
  };

  beforeEach(async () => {
    const registration = await Registration.insert({
      githubHost: registrationPayload.githubHost,
      state: registrationPayload.state,
    });

    await Registration.getRegistration(registrationPayload.state);
  });

  afterEach(async () => {
    // Clean up the database
    await Registration.truncate({ cascade: true, restartIdentity: true });
  });

  // Close connection when tests are done
  afterAll(async () => Registration.close());

  it('store registration when it receives a registration payload', async () => {
    const registration = await Registration.insert({
      githubHost: registrationPayload.githubHost,
      state: registrationPayload.state,
    });

    expect(registration.githubHost).toBe(registrationPayload.githubHost);
    expect(registration.state).toBe(registrationPayload.state);
  });

  it('retrieves registration based on state', async () => {
    const registration = await Registration.getRegistration(registrationPayload.state);

    expect(registration.githubHost).toBe(registrationPayload.githubHost);
    expect(registration.state).toBe(registrationPayload.state);
  });

  it('remove registration', async () => {
    let registration = await Registration.getRegistration(registrationPayload.state);

    await registration.remove();

    registration = await Registration.getRegistration(registrationPayload.state);
    expect(registration).toBe(null);
  });
});
