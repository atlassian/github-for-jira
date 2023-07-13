"use strict";

module.exports = {
	up: async (queryInterface) => {
		//refer to doc https://sequelize.org/v5/class/lib/query-interface.js~queryinterface#instance-method-addConstraint
		await queryInterface.addConstraint("RepoSyncStates", {
			type: "foreign key",
			fields: ["subscriptionId"],
			name: "reposyncstates_subscriptions_id_fk",
			references: {
				table: "Subscriptions",
				field: "id"
			},
			onUpdate: "cascade",
			onDelete: "cascade"
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeConstraint("RepoSyncStates", "reposyncstates_subscriptions_id_fk");
	}
};
