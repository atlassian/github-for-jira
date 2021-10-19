const newJiraSiteBtn = document.getElementById("new-jira-site-modal-btn");
const newJiraSiteModal = document.getElementById("new-jira-site-modal");
const cancelNewJiraSiteBtn = document.getElementById("modal-close");

if (newJiraSiteBtn) {
	newJiraSiteBtn.onclick = function () {
		newJiraSiteModal.style.display = "block";
	};
}

if (cancelNewJiraSiteBtn) {
	cancelNewJiraSiteBtn.onclick = function () {
		newJiraSiteModal.style.display = "none";
	};
}

const hasProtocol = (str) =>
	str.includes("http://") || str.includes("https://") || str.includes("www.");

$(document).ready(() => {
	$(".githubSetup__form__input").on("input", () => {
		// Handle events for main form
		const jiraDomainMain = $("#jiraDomainMain").val();

		if (
			jiraDomainMain &&
			(jiraDomainMain.length > 0 || !hasProtocol(jiraDomainMain))
		) {
			$("#jiraDomainMainSubmitBtn").prop("disabled", false);
			$("#jiraDomainMainSubmitBtn").attr("aria-disabled", "false");
			$(".githubSetup__form__input").removeClass(
				"githubSetup__form__inputError"
			);
			$(".githubSetup__form__errorMessage__container").addClass("hidden");
		}

		if (
			jiraDomainMain &&
			(jiraDomainMain.length === 0 || hasProtocol(jiraDomainMain))
		) {
			$("#jiraDomainMainSubmitBtn").prop("disabled", true);
			$("#jiraDomainMainSubmitBtn").attr("aria-disabled", "true");
			$(".githubSetup__form__input").addClass("githubSetup__form__inputError");
			$(".githubSetup__form__errorMessage__container").removeClass("hidden");
		}

		// Handle events for modal form
		const jiraDomainModal = $("#jiraDomainModal").val();

		if (
			jiraDomainModal &&
			(jiraDomainModal.length > 0 || !hasProtocol(jiraDomainModal))
		) {
			$("#jiraDomainModalSubmitBtn").prop("disabled", false);
			$("#jiraDomainModalSubmitBtn").attr("aria-disabled", "false");
			$(".githubSetup__form__input").removeClass(
				"githubSetup__form__inputError"
			);
			$(".githubSetup__form__errorMessage__container").addClass("hidden");
		}

		if (
			jiraDomainModal &&
			(jiraDomainModal.length === 0 || hasProtocol(jiraDomainModal))
		) {
			$("#jiraDomainModalSubmitBtn").prop("disabled", true);
			$("#jiraDomainModalSubmitBtn").attr("aria-disabled", "true");
			$(".githubSetup__form__input").addClass("githubSetup__form__inputError");
			$(".githubSetup__form__errorMessage__container").removeClass("hidden");
		}
	});
});
