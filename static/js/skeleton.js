$(document).ready(function() {

	setTimeout(function() {
		$('.skeleton-container').remove();
		$('.skeleton-input').remove();
		$('.skeleton').removeClass('skeleton');
		$(".loaded").attr('style', 'display: block !important');
	}, 500);
});
