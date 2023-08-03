export const getJiraJWT = (): Promise<string> => new Promise(resolve => {
	return AP.context.getToken((token: string) => {
		resolve(token);
	});
});

export function popup (url: string, opts: { width: number, height: number }) {
	return window.open(url, "_blank", `popup,${popup_params(opts.width, opts.height)}`);
}

//https://stackoverflow.com/a/4682246
function popup_params(width: number, height: number) {
	try {
    const a = typeof window.screenX != "undefined" ? window.screenX : window.screenLeft;
    const i = typeof window.screenY != "undefined" ? window.screenY : window.screenTop;
    const g = typeof window.outerWidth!="undefined" ? window.outerWidth : document.documentElement.clientWidth;
    const f = typeof window.outerHeight != "undefined" ? window.outerHeight: (document.documentElement.clientHeight - 22);
    const h = (a < 0) ? window.screen.width + a : a;
    const left = h + ((g - width) / 2);
    const top = i + ((f-height) / 2.5);
    return "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",scrollbars=1";
	} catch (_e) {
		return "";
	}
}
