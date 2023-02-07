"use strict";

module.exports = {
	up: async (queryInterface) => {
		//refer to doc https://sequelize.org/v5/class/lib/query-interface.js~queryinterface#instance-method-addConstraint
		await queryInterface.addConstraint("RepoSyncStates", ["subscriptionId"], {
			type: "foreign key",
			name: "fk_reposyncst_subs_subid",
			references: {
				table: "Subscriptions",
				field: "id"
			},
			onUpdate: "cascade",
			onDelete: "cascade"
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeConstraint("RepoSyncStates", "fk_reposyncst_subs_subid");
	}
};
