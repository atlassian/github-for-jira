const models = require('../../lib/models')

beforeAll(async () => {
  if (global.gc) {
    global.gc()
  }
  // Ensure there is a connection established
  models.sequelize.authenticate()
})

// Close connection when tests are done
afterAll(async () => models.sequelize.close())

// Clear all data out of the test database
beforeEach(() => models.sequelize.truncate({ cascade: true, restartIdentity: true }))

module.exports = models
