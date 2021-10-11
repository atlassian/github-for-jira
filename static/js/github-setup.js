const newJiraSiteBtn = document.getElementById("new-jira-site-modal-btn");
const newJiraSiteModal = document.getElementById("new-jira-site-modal");
const cancelNewJiraSiteBtn = document.getElementById("modal-close");

if (newJiraSiteBtn != null) {
	newJiraSiteBtn.onclick = function () {
		newJiraSiteModal.style.display = "block";
	};
}

if (cancelNewJiraSiteBtn != null) {
	cancelNewJiraSiteBtn.onclick = function () {
		newJiraSiteModal.style.display = "none";
	};
}

$(document).ready(() => {
	$(".githubSetup__form__input").on("input", () => {
		// Handle events for main form
		const jiraDomainMain = $("#jiraDomainMain").val();

		if (jiraDomainMain && jiraDomainMain.length > 0) {
			$("#jiraDomainMainSubmitBtn").prop("disabled", false);
			$("#jiraDomainMainSubmitBtn").attr("aria-disabled", "false");
		}

		if (jiraDomainMain && jiraDomainMain.length === 0) {
			$("#jiraDomainMainSubmitBtn").prop("disabled", true);
			$("#jiraDomainMainSubmitBtn").attr("aria-disabled", "true");
		}

		// Handle events for modal form
		const jiraDomainModal = $("#jiraDomainModal").val();

		if (jiraDomainModal && jiraDomainModal.length > 0) {
			$("#jiraDomainModalSubmitBtn").prop("disabled", false);
			$("#jiraDomainModalSubmitBtn").attr("aria-disabled", "false");
		}

		if (jiraDomainModal && jiraDomainModal.length === 0) {
			$("#jiraDomainModalSubmitBtn").prop("disabled", true);
			$("#jiraDomainModalSubmitBtn").attr("aria-disabled", "true");
		}
	});
});
