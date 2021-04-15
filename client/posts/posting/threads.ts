import { on, scrollToElement } from '../../util'
import { page } from '../../state'

// Don't close tab when open form
function preventExit(e: Event) {
	e.preventDefault();
	return "";
}

function expand(e: Event) {
	const el = (e.target as HTMLElement).closest("aside")
	el.classList.add("expanded");
	window.addEventListener("beforeunload", preventExit);
	window.onbeforeunload = preventExit; // chrome related
	page.threadFormIsOpen = true;
	const c = el.querySelector(".captcha-container") as HTMLElement
	if (c) {
		const ns = c.querySelector("noscript");
		if (ns) {
			c.innerHTML = ns.innerHTML;
		}
	}
	const submit = el.querySelector("#thread-form-container input[type=submit]");
	if (submit) {
		submit.addEventListener("click", () => {
			page.threadFormIsOpen = false;
			window.removeEventListener('beforeunload', preventExit);
			window.onbeforeunload = function(){}; // chrome related
		});
	}
}

// Manually expand thread creation form, if any
export function expandThreadForm() {
	const tf = document.querySelector("aside:not(.expanded) .new-thread-button") as HTMLElement
	if (tf) {
		tf.click()
		window.addEventListener("beforeunload", preventExit);
		window.onbeforeunload = preventExit; // chrome related
		page.threadFormIsOpen = true;
		scrollToElement(tf)
	}
	const submit = tf.querySelector("#thread-form-container input[type=submit]");
	if (submit) {
		submit.addEventListener("click", () => {
			page.threadFormIsOpen = false;
			window.removeEventListener('beforeunload', preventExit);
			window.onbeforeunload = function(){}; // chrome related
		});
	}
}

export default () =>
	on(document.getElementById("threads"), "click", expand, {
		selector: ".new-thread-button",
		passive: true,
	})
