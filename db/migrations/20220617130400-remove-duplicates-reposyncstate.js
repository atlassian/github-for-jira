"use strict";

module.exports = {
	up: async (queryInterface) => {
		// Deletes duplicates in RepoSyncState based on the partition between
		// subscriptionId and repoId (no repoId can be the same under the same subscriptionId)
		// The inner select gets all duplicates and returns the id (our primary key) in
		// ascending order (first one created is first) and the current row number in a temp table.
		// The outer select then only selects the id from the temp table for those of row number
		// above 1 (leaving the first row out) essentially only selecting the extra duplicates.
		// Then we just delete everything with those ids in RepoSyncState.
		await queryInterface.sequelize.query(`
			DELETE FROM "RepoSyncStates" WHERE id IN (
				SELECT id FROM (
					SELECT id, ROW_NUMBER() OVER(
					    PARTITION BY "subscriptionId", "repoId" ORDER BY id
					) AS row_num FROM "RepoSyncStates"
			) t WHERE t.row_num > 1);
		`);
	},

	down: async (queryInterface) => {
		// There's no coming back from this....
	}
};
