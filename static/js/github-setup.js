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
