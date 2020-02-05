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

  it('retrieves aged sync count', async () => {
    await createSubscription()
    const sub2 = await createSubscription()
    const sub3 = await createSubscription()
    const sub4 = await createSubscription()
    const sub5 = await createSubscription()
    const sub6 = await createSubscription()
    await setUpdatedAt(sub2, moment().subtract(10, 'd'))
    await setUpdatedAt(sub3, moment().subtract(20, 'd'))

    await setUpdatedAt(sub4, moment().subtract(10, 'd'))
    await sub4.update({ syncStatus: 'COMPLETE' }, { silent: true })

    await setUpdatedAt(sub5, moment().subtract(10, 'd'))
    await sub5.update({ syncStatus: 'PENDING' }, { silent: true })

    await setUpdatedAt(sub6, moment().subtract(10, 'd'))
    await sub6.update({ syncStatus: null }, { silent: true })

    const agedSubscriptions = await Subscription.agedSyncCounts(7)
    expect(agedSubscriptions.length).toBe(3)
    expect(agedSubscriptions.find((h) => h.syncStatus === 'ACTIVE')).toMatchObject({ count: '2', syncStatus: 'ACTIVE' })
    expect(agedSubscriptions.find((h) => h.syncStatus === 'PENDING')).toMatchObject({ count: '1', syncStatus: 'PENDING' })
    expect(agedSubscriptions.find((h) => h.syncStatus === null)).toMatchObject({ count: '1', syncStatus: null })
  })
})
