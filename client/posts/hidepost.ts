import { on } from "../util"

function hidePostButton(e: Event) {
	const el = (e.target as Element).closest(".hidepost");
	const control = el.parentElement.querySelector(".control") as HTMLElement;
	control.click();
	const hideElement = control.querySelector('.popup-menu li[data-id="hide"]') as HTMLElement;
	hideElement.click();
}

export default () =>
	on(document, "click", hidePostButton, {
		passive: true,
		selector: ".hidepost, .hidepost svg, .hidepost path, .hidepost line",
	})
