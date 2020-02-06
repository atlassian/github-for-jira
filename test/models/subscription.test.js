const { Subscription } = require('../models')
const moment = require('moment')

describe(Subscription, () => {
  const createSubscription = async function () {
    return Subscription.create({
      gitHubInstallationId: 1,
      jiraHost: 'https://example.atlassian.net',
      syncStatus: 'ACTIVE'
    })
  }

  const setUpdatedAt = async function (sub, date) {
    await Subscription.update({ updatedAt: date }, { where: { id: sub.id }, silent: true })
    return sub.reload()
  }

  beforeEach(async () => {
    this.sub1 = await createSubscription()
    this.sub2 = await createSubscription()
    this.sub3 = await createSubscription()
    this.sub4 = await createSubscription()
    this.sub5 = await createSubscription()
    this.sub6 = await createSubscription()
    await setUpdatedAt(this.sub2, moment().subtract(10, 'd'))
    await setUpdatedAt(this.sub3, moment().subtract(20, 'd'))

    await setUpdatedAt(this.sub4, moment().subtract(10, 'd'))
    await this.sub4.update({ syncStatus: 'COMPLETE' }, { silent: true })

    await setUpdatedAt(this.sub5, moment().subtract(10, 'd'))
    await this.sub5.update({ syncStatus: 'PENDING' }, { silent: true })

    await setUpdatedAt(this.sub6, moment().subtract(15, 'd'))
    await this.sub6.update({ syncStatus: null }, { silent: true })
  })

  it('retrieves aged sync count', async () => {
    const agedSubscriptions = await Subscription.agedSyncCounts('7 days')
    expect(agedSubscriptions.length).toBe(3)
    expect(agedSubscriptions.find((h) => h.syncStatus === 'ACTIVE')).toMatchObject({ count: '2', syncStatus: 'ACTIVE' })
    expect(agedSubscriptions.find((h) => h.syncStatus === 'PENDING')).toMatchObject({ count: '1', syncStatus: 'PENDING' })
    expect(agedSubscriptions.find((h) => h.syncStatus === null)).toMatchObject({ count: '1', syncStatus: null })
  })

  it('retreives aged counts within a time range', async () => {
    const agedSubscriptions = await Subscription.agedSyncCounts('7 days', '11 days')
    expect(agedSubscriptions.length).toBe(2)
    expect(agedSubscriptions.find((h) => h.syncStatus === 'ACTIVE')).toMatchObject({ count: '1', syncStatus: 'ACTIVE' })
    expect(agedSubscriptions.find((h) => h.syncStatus === 'PENDING')).toMatchObject({ count: '1', syncStatus: 'PENDING' })
  })
})
