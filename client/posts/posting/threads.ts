import { on, scrollToElement } from '../../util'
import { page } from '../../state'

function expand(e: Event) {
	const el = (e.target as HTMLElement).closest("aside")
	el.classList.add("expanded");
	window.addEventListener("beforeunload", preventExit);
	page.threadFormIsOpen = true;
	const c = el.querySelector(".captcha-container") as HTMLElement
	if (c) {
		const ns = c.querySelector("noscript");
		if (ns) {
			c.innerHTML = ns.innerHTML;
		}
	}
}

// Don't close tab when open form
function preventExit(e: Event) {
	e.preventDefault();
	return "";
}

// Manually expand thread creation form, if any
export function expandThreadForm() {
	const tf = document.querySelector("aside:not(.expanded) .new-thread-button") as HTMLElement
	if (tf) {
		tf.click()
		window.addEventListener("beforeunload", preventExit);
		page.threadFormIsOpen = true;
		scrollToElement(tf)
	}
}

export default () =>
	on(document.getElementById("threads"), "click", expand, {
		selector: ".new-thread-button",
		passive: true,
	})
