let queriedRepos = [];
let totalRepos = [];
let uuid;

$(document).ready(() => {

	// Fetching the list of default repos
  totalRepos = $(".default-repos").map((_, option) => ({
    id: $(option).html(),
    text: $(option).html()
  })).toArray();

  uuid = $("#createBranchForm").attr("data-ghe-uuid");
  let url = "/github/repository";
  if(uuid) {
    url = `/github/${uuid}/repository`;
  }
  $("#ghRepo").auiSelect2({
    placeholder: "Select a repository",
    data: totalRepos,
    formatNoMatches: () => "No search results",
    dropdownCssClass: "ghRepo-dropdown", // this classname is used for displaying spinner
    _ajaxQuery: Select2.query.ajax({
      dataType: "json",
      quietMillis: 500,
      url,
      data: term => ({
        repoName: term
      }),
      results: function (response) {
        const { repositories } = response;
        repositories.forEach(repository => {
          if (queriedRepos.filter(repo => repo.id === repository?.full_name).length < 1) {
            const additionalRepo = {
              id: repository.full_name,
              text: repository.full_name
            };
            queriedRepos.unshift(additionalRepo);
          }
        });
        showLoaderInsideSelect2Dropdown("ghRepo", false);
        return {
          results: queriedRepos.length ? [{
            text: "Repositories",
            children: queriedRepos
          }] : []
        }
      }
    }),
    query: function (options) {
      const userInput = options.term;
      queriedRepos = totalRepos.filter(repo => repo.id.toUpperCase().indexOf(userInput.toUpperCase()) >= 0);
      if (userInput.length) {
        showLoaderInsideSelect2Dropdown("ghRepo", true);
        this._ajaxQuery.call(this, options);
      } else {
        options.callback({
          results: queriedRepos.length ? [{
            text: "Recently Updated Repositories",
            children: queriedRepos
          }] : []
        });
      }
    }
  })
    .on("select2-close", () => {
      if ($("#ghRepo").val().length) {
        $(".no-repo-container").hide();
      } else {
        $(".no-repo-container").show();
      }
      showLoaderInsideSelect2Dropdown("ghRepo", false);
    });

  $("#ghParentBranch").auiSelect2({
    placeholder: "Select a branch",
    data: []
  });

	$("#ghParentBranch").on("change", function (e) {
		validateSourceBranch(e.val);
	});

  $("#ghRepo").on("change", () => {
    loadBranches();
  });

  $("#createBranchForm").on("aui-valid-submit", (event) => {
    event.preventDefault();
    if (validateForm()) {
      createBranchPost();
    }
  });

  $("#changeLogin").click(function (event) {
    event.preventDefault();
    changeGitHubLogin();
  });

  $("#openGitBranch").click(function () {
    const repo = getRepoDetails();
    window.open(`${$("#gitHubHostname").val()}/${repo.owner}/${repo.name}/tree/${$("#branchNameText").val()}`);
  });
});

$("#changeInstance").click(function (event) {
	event.preventDefault();
	changeGitHubInstance();
});

const validateSourceBranch = (branchName) => {
	hideValidationErrorMessage("ghParentBranch");
	const repo = getRepoDetails();
	const url = `/github/branch/owner/${repo.owner}/repo/${repo.name}/${branchName}`;

	$.get(url)
		.fail((err) => {
			if (err.status === 404) {
				showValidationErrorMessage("ghParentBranch", "Could not find this branch on GitHub.");
			}
		});
}

const loadBranches = () => {
  showLoaderOnSelect2Input("ghParentBranch", true);
  clearBranches();
  toggleSubmitDisabled(true);
  hideErrorMessage();
  const repo = getRepoDetails();
	const jiraHost = $("#jiraHost").val();
  let url = `/github/create-branch/owners/${repo.owner}/repos/${repo.name}/branches?jiraHost=${jiraHost}`;
  if(uuid) {
    url = `/github/${uuid}/create-branch/owners/${repo.owner}/repos/${repo.name}/branches?jiraHost=${jiraHost}`;
  }
  $.ajax({
    type: "GET",
    url,
    success: (response) => {
      const { branches, defaultBranch } = response;
      const allBranches = branches.map((item) => ({
        id: item.name,
        name: item.name
      }));
      allBranches.unshift({ id: defaultBranch, name: defaultBranch });

      $("#ghParentBranch").auiSelect2({
        data: () => {
          return {
            text: item => item.name,
            results: allBranches
          }
        },
        formatSelection: item => item.name,
        formatResult: item => item.name,
        createSearchChoice: (term) => {
          return {
            name: term,
            id: term
          }
        }
      });
      $("#ghParentBranch").select2("val", defaultBranch);
      toggleSubmitDisabled(false);
      showLoaderOnSelect2Input("ghParentBranch", false);
    },
    error: () => {
      showErrorMessage("We couldn't fetch the branches because something went wrong. Please try again.");
      toggleSubmitDisabled(false);
      showLoaderOnSelect2Input("ghParentBranch", false);
    }
  });
};

const validateForm = () => {
  let validated = true;
  if (!$("#ghRepo").select2("val")) {
    showValidationErrorMessage("ghRepo", "This field is required.");
    validated = false;
  }
  if (!$("#ghParentBranch").select2("val")) {
    showValidationErrorMessage("ghParentBranch", "This field is required.");
    validated = false;
  }
  return validated;
};

const showValidationErrorMessage = (id, message) => {
  const DOM = $(`#s2id_${ id }`);
  DOM.find("a.select2-choice").addClass("has-errors");
  if (DOM.find(".error-message").length < 1) {
    DOM.append(`<div class="error-message"><i class="aui-icon aui-iconfont-error"></i>${ message }</div>`);
  }
};

const hideValidationErrorMessage = (id) => {
  const DOM = $(`#s2id_${ id }`);
  DOM.find("a.select2-choice").removeClass("has-errors");
	DOM.find(".error-message").remove();
};

const createBranchPost = () => {
	const jiraHost = $("#jiraHost").val();
	let url = `/github/create-branch?jiraHost=${jiraHost}`;
  if(uuid) {
    url = `/github/${uuid}/create-branch?jiraHost=${jiraHost}`;
  }
  const repo = getRepoDetails();
  const newBranchName = $("#branchNameText").val();
  const data = {
    owner: repo.owner,
    repo: repo.name,
		jiraHostEncoded: encodeURIComponent(jiraHost),
    sourceBranchName: $("#ghParentBranch").select2("val"),
    newBranchName,
    _csrf: $("#_csrf").val(),
  };
  toggleSubmitDisabled(true);
  hideErrorMessage();

  showLoading();
  $.post(url, data)
    .done(() => {
      showSuccessScreen(repo);
    })
    .fail((error) => {
      toggleSubmitDisabled(false);
      showErrorMessage(error.responseJSON.error);
      hideLoading();
    });
};

const showLoading = () => {
  $("#createBranchForm").hide();
  $(".headerImageLogo").addClass("headerImageLogo-lg");
  setTimeout(() => {
    $(".gitHubCreateBranch__spinner").show();
  }, 750);
};

const showSuccessScreen = (repo) => {
  $(".gitHubCreateBranch__spinner").hide();
  $(".headerImageLogo").attr("src", "/public/assets/jira-github-connection-success.svg");
  $(".gitHubCreateBranch__header").html("GitHub branch created");
  $(".gitHubCreateBranch__subHeader").html(`Branch <b>${$("#branchNameText").val()}</b> created in ${repo.owner}/${repo.name}`);
  $(".gitHubCreateBranch__createdLinks").css("display", "flex");
};

const hideLoading = () => {
  $("#createBranchForm").show();
  $(".headerImageLogo").removeClass("headerImageLogo-lg");
  $(".gitHubCreateBranch__spinner").hide();
};

const toggleSubmitDisabled = (bool) => {
  $("#createBranchBtn").prop("disabled", bool);
  $("#createBranchBtn").attr("aria-disabled", String(bool));
}

const getRepoDetails = () => {
  const repoWithOwner = $("#ghRepo").select2("val").split("/");
  return {
    owner: repoWithOwner[0],
    name: repoWithOwner[1],
  }
};

const showErrorMessage = (messages) => {
  $(".gitHubCreateBranch__serverError").show();
  $(".errorMessageBox__message").empty().append(`${messages}`);
};

const hideErrorMessage = () => {
  $(".has-errors").removeClass("has-errors");
  $(".error-message").remove();
  $(".gitHubCreateBranch__serverError").hide();
};

const clearBranches = () => {
  $("#ghParentBranch").auiSelect2({ data: [] });
};

const showLoaderInsideSelect2Dropdown = (inputDOM, isLoading) => {
  const loader = ".select2-loader";
  const container = $(`.${ inputDOM }-dropdown`);
  const options = container.find(".select2-results");

  if (isLoading) {
    options.css("display", "none");
    if (!container.find(loader).length) {
      options.after(`<div class="select2-loader"><aui-spinner size="small"></aui-spinner></div>`);
    }
  } else {
    options.css("display", "block");
    container.find(loader).remove();
  }
};

const showLoaderOnSelect2Input = (inputDOM, isLoading) => {
  const loader = ".select2-loader";
  const container = $(`#s2id_${ inputDOM }`).parent();

  if (isLoading) {
    if (!container.find(loader).length) {
      container.prepend(`<div class="select2-loader select2-loader-for-input"><aui-spinner size="small"></aui-spinner></div>`);
      $(`#${inputDOM}`).auiSelect2("enable", false);
    }
  } else {
    container.find(loader).remove();
    $(`#${inputDOM}`).auiSelect2("enable", true);
  }
}

const changeGitHubLogin = () => {
  $.ajax({
    type: "GET",
    url: `/github/create-branch/change-github-login`,
    success: (data) => {
      window.open(data.baseUrl, "_blank");
    },
    error: (error) => {
      console.log(error);
    }
  });
};

const changeGitHubInstance = () => {
	const url = new URL(window.location.href);
	document.location.href = `/create-branch-options${url.search}`;
}
