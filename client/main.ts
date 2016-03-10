/*
 * Client entry point.
 * NOTE: All modules use strict mode implicitly
 */

import {parseHTML, parseEl} from './util'
import {posts} from './lang'
import {init as initState} from './state'

declare var config: any
declare var isMobile: boolean

initState(config, isMobile)

// Clear cookies, if versions mismatch.
const cookieVersion = 4
if (localStorage.getItem("cookieVersion") != cookieVersion) {
	for (let cookie of document.cookie.split(";")) {
		const eqPos = cookie.indexOf("="),
			name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
		document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT"
	}
	localStorage.setItem("cookieVersion", cookieVersion.toString())
}

// Load language-specific CSS
document.head.appendChild(parseEl(parseHTML
	`<style>
		.locked:after {
			content: "${posts.threadLocked}";
		}
		.locked > header nav:after {
			content: " (${posts.locked})";
		}
	</style>`))

//events.request('loading:hide')
