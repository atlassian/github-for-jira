module.exports = {
  isMaintenanceMode: () => process.env.MAINTENANCE_MODE === 'true' || false,
};
