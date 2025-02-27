// Contains the FSM and core API for accessing the post authoring system

import FormModel from "./model"
import FormView from "./view"
import { connState, connSM, handlers, message } from "../../connection"
import { on, FSM, hook } from "../../util"
import lang from "../../lang"
import identity, { initIdentity } from "./identity"
import * as state from "../../state";
import initDrop from "./drop"
import initPaste from "./paste"
import initImageErr from "./image"
import initThreads from "./threads"
import { renderCaptchaForm, captchaLoaded } from "../../ui/captcha";
import * as page from "../../page";
import options from "../../options";

export { default as FormModel } from "./model"
export { default as identity } from "./identity"
export { expandThreadForm } from "./threads"

type Selection = {
	start: Node
	end: Node
	text: string
}

// Current post form view and model instances
let postForm: FormView,
	postModel: FormModel,
	// Store last selected range, so we can access it after a mouse click on
	// quote links, which cause that link to become selected
	lastSelection: Selection

// Post authoring finite state machine
export const enum postState {
	// No state. Awaiting first connection.
	none,
	// Ready to create posts
	ready,
	// Post allocated to the server but no connectivity
	halted,
	// No post open. Post creation controls locked.
	locked,
	// Post open and allocated to the server
	alloc,
	// Post open, but not yet allocating
	draft,
	// Sent a request to allocate a live post
	allocating,
	// Sending a request to a allocate a post in non-live mode
	allocatingNonLive,
	// Suffered unrecoverable error
	erred,
	// Post creation disabled in thread
	threadLocked,
}
export const enum postEvent {
	// Synchronized to the server
	sync,
	// Disconnected from server
	disconnect,
	// Unrecoverable error
	error,
	// Post closed
	done,
	// Post canceled
	cancel,
	// New post opened
	open,
	// Set to none. Used during page navigation.
	reset,
	// A live post allocation request has been sent to the server
	sentAllocRequest,
	// Allocated the draft post to the server
	alloc,
	// Ownership of post reclaimed after connectivity loss
	reclaim,
	// Abandon ownership of any open post
	abandon,
	// Server requested to solve a captcha
	captchaRequested,
	// Captcha successfully solved
	captchaSolved,
}
export const postSM = new FSM<postState, postEvent>(postState.none)

hook("getPostModel", () =>
	postModel)

// Find the post creation button and style it, if any
function stylePostControls(fn: (el: HTMLElement) => void) {
	const el = document.querySelector("aside.posting") as HTMLElement
	if (el) {
		fn(el)
	}
}

// Ensures you are nagged at by the browser, when navigating away from an
// unfinished allocated post.
function bindNagging() {
	window.onbeforeunload = (event: BeforeUnloadEvent) =>
		event.returnValue = lang.ui["unfinishedPost"]
}

// Insert target post's number as a link into the text body. If text in the
// post is selected, quote it.
function quotePost(e: MouseEvent) {
	// Don't trigger, when user is trying to open in a new tab
	const bypass = e.which !== 1
		|| e.ctrlKey
		|| (state.page.thread && connSM.state !== connState.synced)
	if (bypass) {
		return
	}

	const target = e.target as HTMLAnchorElement

	// Make sure the selection both starts and ends in the quoted post's
	// blockquote
	const post = target.closest("article")
	const isInside = (prop: string): boolean => {
		const node = lastSelection[prop] as Node
		if (!node) {
			return false
		}
		const el = node.nodeType === Node.TEXT_NODE
			? node.parentElement
			: node as Element
		if (!el) { // No idea why, but el sometimes is null
			return false
		}

		// Selection bound is mid-post
		if (el.closest("blockquote") && el.closest("article") === post) {
			return true
		}
		switch (prop) {
			// Selection start at blockquote start
			case "start":
				return el === post
			// Selection end is at blockquote end
			case "end":
				if (el.closest("article") === post.nextSibling) {
					return true
				}
				if (el.tagName === "SECTION") {
					// Avoids capturing the [Reply] button
					const i = lastSelection.text.lastIndexOf("\n")
					if (i >= 0) {
						lastSelection.text = lastSelection.text.slice(0, i)
					}
					return true
				}
				return false
		}
	}
	let sel = ""
	if (lastSelection && isInside("start") && isInside("end")) {
		sel = lastSelection.text
	}

	const id = parseInt(post.id.slice(1))

	// On board pages, first navigate to the thread
	if (!state.page.thread) {
		location.href = target.href

		// Store, so a reply is opened, when the page is loaded
		localStorage.setItem("openQuote", `${id}:${sel}`)
		return
	}

	postSM.feed(postEvent.open)
	postModel.addReference(id, sel)
}

// Update the draft post's fields on identity change, if any
function updateIdentity() {
	if (postSM.state === postState.draft && !state.boardConfig.forcedAnon) {
		postForm.renderIdentity()
	}
}

// Don't close tab when open form
function preventExit(e: Event) {
  e.preventDefault();
  return "";
}


async function openReply(e: MouseEvent) {
	// Don't trigger, when user is trying to open in a new tab
	if (e.which !== 1
		|| !state.page.thread
		|| e.ctrlKey
		|| connSM.state !== connState.synced
	) {
		return
	}

	e.preventDefault()
	postSM.feed(postEvent.open)
}

export default () => {
	// Synchronise with connection state machine
	connSM.on(connState.synced, postSM.feeder(postEvent.sync))
	connSM.on(connState.dropped, postSM.feeder(postEvent.disconnect))
	connSM.on(connState.desynced, postSM.feeder(postEvent.error))

	// The server notified a captcha will be required on the next post
	handlers[message.captcha] = postSM.feeder(postEvent.captchaRequested);

	// Initial synchronization
	postSM.act(postState.none, postEvent.sync, () =>
		postState.ready)

	// Set up client to create new posts
	postSM.on(postState.ready, () => {
		if (postModel) {
			postModel.abandon();
		}

		// Don't null postForm. It may still be modified mid-transition
		window.onbeforeunload = postModel = null

		stylePostControls(el => {
			el.style.display = ""
			el.classList.remove("disabled")
		})
	})

	// Update Done button on any state change
	postSM.onChange(() => {
		if (postForm) {
			postForm.updateDoneButton();
		}
	});

	// Handle connection loss
	postSM.wildAct(postEvent.disconnect, () => {
		switch (postSM.state) {
			case postState.alloc:       // Pause current allocated post
			case postState.halted:
				return postState.halted
			case postState.draft:       // Clear any unallocated postForm
				//postForm.remove()
				//postModel = postForm = null
				stylePostControls(el =>
					el.style.display = "")
				return postState.halted;
				//break;
			case postState.locked:
				return postState.locked
		}

		stylePostControls(el =>
			el.classList.add("disabled"))

		return postState.locked
	})

	// Regained connectivity, when post is allocated
	postSM.act(postState.halted, postEvent.reclaim, () => {
		//console.log("postState.halted, postEvent.reclaim");
		return postState.alloc})

	// Regained connectivity too late and post can no longer be reclaimed
	postSM.act(postState.halted, postEvent.abandon, () => {
		//console.log("postState.halted, postEvent.abandon");
		if (postForm) {
			return postState.draft;
		}
		return postState.ready})

	// Regained connectivity, when no post open
	postSM.act(postState.locked, postEvent.sync, () => {
		//console.log("sync!");
		if (postForm) {
			return postState.draft;
		}
		return postState.ready;
	})

	// Handle critical errors
	postSM.wildAct(postEvent.error, () => {
		stylePostControls(el =>
			el.classList.add("erred"))
		postForm && postForm.renderError()
		window.onbeforeunload = null
		return postState.erred
	})

	// Reset state during page navigation
	postSM.wildAct(postEvent.reset, () =>
		postState.ready);

	// Transition a draft post into allocated state. All the logic for this is
	// model- and view-side.
	postSM.act(postState.allocating, postEvent.alloc, () => {
		//console.log("postState.allocating, postEvent.alloc");
		return postState.alloc;
	});
	postSM.act(postState.allocatingNonLive, postEvent.alloc, () => {
		//console.log("postState.allocatingNonLive, postEvent.alloc");
		return postState.ready;
		//return postState.draft;
	});


	postSM.on(postState.alloc, bindNagging);
	postSM.on(postState.alloc, () => {
		if (options.watchThreadsOnReply) {
			page.watchCurrentThread();
		}
	});

	// Open a new post creation form, if none open
	postSM.act(postState.ready, postEvent.open, () => {
		//console.log("postState.ready, postEvent.open");
		postModel = new FormModel()
		postForm = new FormView(postModel)
		window.addEventListener("beforeunload", preventExit);
		window.onbeforeunload = preventExit; // chrome related
		return postState.draft
	})

	// Hide post controls, when a postForm is open
	const hidePostControls = () =>
		stylePostControls(el =>
			el.style.display = "none")
	postSM.on(postState.draft, hidePostControls)
	postSM.on(postState.alloc, () =>
		hidePostControls())

	postSM.act(postState.draft, postEvent.sentAllocRequest, () => {
		//console.log("postState.draft, postEvent.sentAllocRequest");
		if (!state.boardConfig.forcedLive && !identity.live) {
			//console.log("!identity.live");
			//postModel.commitNonLiveEnd();
			return postState.allocatingNonLive;
		}
		return postState.allocating;
	});

	// Server requested captcha. This rejects the previous post or image
	// allocation request.
	for (let s of [
		postState.draft, postState.allocating, postState.allocatingNonLive,
	]) { 
		postSM.act(s, postEvent.captchaRequested, () => {
			//console.log(s, "postState.draft, postState.allocating, postState.allocatingNonLive, postEvent.captchaRequested");
			postModel.inputBody = "";
			renderCaptchaForm(postSM.feeder(postEvent.captchaSolved));
			if (postForm.upload) {
				postForm.upload.reset();
			}
			return postState.draft;
		});
	}
	postSM.act(postState.alloc, postEvent.captchaRequested, () => {
		//console.log("postState.alloc, postEvent.captchaRequested");
		renderCaptchaForm(postSM.feeder(postEvent.captchaSolved));
		if (postForm.upload) {
			postForm.upload.reset();
		}
		return postState.alloc;
	})

	// Attempt to resume post after solving captcha
	for (let s of [postState.draft, postState.allocating, postState.alloc]) {
		// Capture variable in inner scope
		((s: postState) => {
			//console.log("postState.draft, postState.allocating, postState.alloc");
			postSM.act(s, postEvent.captchaSolved, () => {
				//console.log("postEvent.captchaSolved");
				if (!state.boardConfig.forcedLive && !identity.live) {
					if (isEmpty()) {
						postForm.input.focus();
						return postState.draft;
					}
					//console.log("!identity.live postModel.commitNonLive()");
					postModel.commitNonLive();
					//console.log("postState.allocatingNonLive");
					return postState.allocatingNonLive;
				} 
				if (postSM.state === postState.draft) {
					const b = postForm.input.value;
					if (b) {
						postModel.parseInput(b);
					}
				}
				//console.log("postModel.retryUpload()");
				postModel.retryUpload();
				postForm.input.focus();
				return s;
			});
		})(s);
	}

	// Close unallocated draft or commit in non-live mode
	postSM.act(postState.draft, postEvent.done, () => {
		window.removeEventListener('beforeunload', preventExit);
		//console.log("postState.draft, postEvent.done");
		if (captchaLoaded()) {
			//console.log("captchaLoaded() return postState.draft");
			return postState.draft;
		}

		// Commit a draft made as a non-live post
		if (!state.boardConfig.forcedLive && !identity.live && !isEmpty()) {
			//console.log("!identity.live && !isEmpty() ->postState.allocatingNonLive");
			postModel.commitNonLive();
			//console.log("!identity.live && !isEmpty() ->postModel.commitNonLive() & return postState.allocatingNonLive");
			//console.log(identity, postForm, postModel);
			//postSM.feed(postEvent.done);
			return postState.draft;
			//return postState.allocatingNonLive;
		}
		//console.log("postForm.remove()->");
		postForm.remove();
		//console.log("postForm.remove(); return postState.ready");
		return postState.ready;
	})

	// Cancel unallocated draft
	postSM.act(postState.draft, postEvent.cancel, () => {
		if (window.confirm(lang.ui["cancel"]+"?")) {
			window.removeEventListener('beforeunload', preventExit);
			window.onbeforeunload = function(){}; // chrome related
			//console.log("postState.draft, postEvent.cancel");
			postForm.remove()
			return postState.ready
		} else {
			return postState.draft;
		}
	})

	// Close allocated post
	postSM.act(postState.alloc, postEvent.done, () => {
		//console.log("postState.alloc, postEvent.done");
		window.removeEventListener('beforeunload', preventExit);
		window.onbeforeunload = function(){}; // chrome related
		if (captchaLoaded()) {
			//console.log("postState.alloc, postEvent.done captchaLoaded()");
			return postState.alloc;
		}
		postModel.commitClose(false);
		//postModel.commitClose();
		return postState.ready;
	});


	// Cancel allocated post
	postSM.act(postState.alloc, postEvent.cancel, () => {
		//console.log("postState.alloc, postEvent.cancel");
		window.removeEventListener('beforeunload', preventExit);
		window.onbeforeunload = function(){}; // chrome related
		postModel.commitClose(true)
		return postState.ready;
	})

	// Just close the post, after it is committed
	postSM.act(postState.allocatingNonLive, postEvent.done, () => {
		window.removeEventListener('beforeunload', preventExit);
		//console.log("postState.allocatingNonLive, postEvent.done");
		return postState.ready;
	});

	postSM.act(postState.allocatingNonLive, postEvent.open, () => {
		//console.log("postState.allocatingNonLive, postEvent.open");
		return postState.ready;
	});
	/*
	postSM.act(postState.allocatingNonLive, postEvent.captchaRequested, () => {
		console.log("postState.allocatingNonLive, postEvent.captchaRequested");
		return postState.ready;
	});
	*/
	postSM.act(postState.allocatingNonLive, postEvent.captchaSolved, () => {
		//console.log("postState.allocatingNonLive, postEvent.captchaSolved");
		return postState.ready;
	});
	postSM.act(postState.allocatingNonLive, postEvent.sentAllocRequest, () => {
		//console.log("postState.allocatingNonLive, postEvent.sentAllocRequest");
		//postModel.commitNonLiveEnd();
		postModel.commitClose(false);
		return postState.ready;
		//return postState.draft;
	});
	postSM.act(postState.allocatingNonLive, postEvent.alloc, () => {
		//console.log("postState.allocatingNonLive, postEvent.alloc");
		postModel.commitNonLiveEnd();
		return postState.ready;
	});


	// Just cancel the post, after it is committed
	postSM.act(postState.allocatingNonLive, postEvent.cancel, () => {
		//console.log("postState.allocatingNonLive, postEvent.cancel");
		return postState.ready;
	});


	// Handle clicks on the [Reply] button
	on(document, "click", openReply, {
		selector: "aside.posting a",
	})

	// Handle clicks on post quoting links
	on(document, "click", quotePost, {
		selector: "a.quote",
	})

	// Store last selected range that is not a quote link
	document.addEventListener("selectionchange", () => {
		const sel = getSelection(),
			start = sel.anchorNode
		if (!start) {
			return
		}
		const el = start.parentElement
		if (el && !el.classList.contains("quote")) {
			lastSelection = {
				start: sel.anchorNode,
				end: sel.focusNode,
				text: sel.toString().trim(),
			}
		}
	})

	// Trigger post form updates on post option change
	for (let id of ["name", "auth", "sage"]) {
		identity.onChange(id, updateIdentity)
	}

	// Toggle live update committing on the input form, if any
	identity.onChange("live", (live: boolean) => {
		if (postSM.state !== postState.draft) {
			return;
		}
		postForm.setEditing(live);
		postForm.updateDoneButton();
		//postForm.inputElement("done").hidden = live;
	});

	initDrop()
	initPaste()
	initImageErr()
	initThreads()
	initIdentity()
}

function isEmpty(): boolean {
	return !postForm.input.value && !postForm.upload.hiddenInput.files.length;
	// && !hasBufferedImage();
}
