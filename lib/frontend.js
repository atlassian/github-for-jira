const express = require('express')
const path = require('path')

module.exports = (robot) => {
  const app = robot.route()

  app.use('/static', express.static(path.join(__dirname, '..', 'static')))
}
