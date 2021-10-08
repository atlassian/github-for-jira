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
		const jiraSubdomain = $("#jiraSubdomain").val();

		if (jiraSubdomain.length > 0) {
			$("#jiraSubdomainSubmitBtn").prop("disabled", false);
			$("#jiraSubdomainSubmitBtn").attr("aria-disabled", "false");
		}

		if (jiraSubdomain.length === 0) {
			$("#jiraSubdomainSubmitBtn").prop("disabled", true);
			$("#jiraSubdomainSubmitBtn").attr("aria-disabled", "true");
		}
	});
});

$(document).ready(() => {
	$(".githubSetup__form__input__modal").on("input", () => {
		const jiraSubdomainModal = $("#jiraSubdomainModal").val();

		if (jiraSubdomainModal.length > 0) {
			$("#jiraSubdomainModalSubmitBtn").prop("disabled", false);
			$("#jiraSubdomainModalSubmitBtn").attr("aria-disabled", "false");
		}

		if (jiraSubdomainModal.length === 0) {
			$("#jiraSubdomainModalSubmitBtn").prop("disabled", true);
			$("#jiraSubdomainModalSubmitBtn").attr("aria-disabled", "true");
		}
	});
});
