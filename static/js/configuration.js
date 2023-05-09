
$('.ui.accordion').accordion({
	exclusive: true,
	onOpening: () => {
		console.log("onOpening....");
	},
	onChanging: () => {
		console.log("onChanging....");
		//	return false;
	}
});

$(document).ready(() => {
	let state = $('body').attr('data-state');
	if (state) {
		state = JSON.parse(state);
	}
	console.log(state);
	loadStep1State(state);
	loadStep2State(state);

	$('#step1-next').click(() => {
		state.step1.data.serverName = $("#server-name").val();
		state.step1.state = "completed";
		saveState(state);
		$('.ui.accordion').accordion('open', 1);
	});

	$('#step2-next').click(() => {
		state.step2.data.appName = $("#app-name").val();
		state.step2.state = "completed";
		saveState(state);
		$('.ui.accordion').accordion('open', 2);
	});

	$('#reset').click(() => {
		state.step1.data = { };
		state.step1.state = "pending";
		state.step2.data = { };
		state.step2.state = "pending";
		saveState(state);
		$('.ui.accordion').accordion('open', 0);
		loadStep1State(state);
		
	});

});

const saveState = (state) => {

	$.ajax({
		type: "POST",
		url: "/saveState",
		data: JSON.stringify({ state }),
		'contentType': 'application/json',
		success: () => {
			console.log("state saved");
		}
	});

};

const loadStep1State = (state) => {
	if (state.step1.data?.serverName) {
		$("#server-name").val(state.step1.data?.serverName);
	} else {
		$("#server-name").val("");
	}
	if (state.step1.state == "completed") {
		$('.ui.accordion').accordion('open', 1);
	}

};

const loadStep2State = (state) => {
	if (state.step2.data?.appName) {
		$("#app-name").val(state.step2.data?.appName);
	}
	if (state.step2.state == "completed") {
		$('.ui.accordion').accordion('open', 2);
	}

};