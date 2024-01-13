// Selects and loads the client files and polyfills, if any. Use only ES5.

(function () {
	// Check if the client is an automated crawler
	var isBot,
		botStrings = [
			"bot", "googlebot", "crawler", "spider", "robot", "crawling"
		];

	for (var i = 0; i < botStrings.length; i++) {
		if (navigator.userAgent.indexOf(botStrings[i]) !== -1) {
			isBot = true;
			break;
		}
	}

	// Display mature content warning
	if (!isBot && config.mature && !localStorage.getItem("termsAccepted")) {
		var confirmText =
			"Заходя на данный сайт, вы соглашаетесь с тем что:\n\n"
			+ "1. Содержимое этого сайта предназначено только для взрослой аудитории и может быть ненадлежащим для несовершеннолетних лиц. Если вы не достигли совершеннолетия или не имеете законного права просматривать контент для совершеннолетних, покиньте данный сайт.\n\n"
			+ "2. Сайт предоставляется «как есть», без гарантий, явных или подразумевающихся. Продолжая просмотр, вы соглашаетесь что владельцы сайта не несут ответственности за любой ущерб, который может быть нанесён вам данным сайтом, и подтверждаете, что осознаёте, что контент опубликованный на сайте создан пользователями и является собственностью пользователей, а не владельцев данного сайта."
			+ "\n\n"
			+ "To access this website you understand and agree to the following:\n\n"
			+ "1. The content of this website is for mature audiences only and may not be suitable for minors. If you are a minor or it is illegal for you to access mature images and language, do not proceed.\n\n"
			+ "2. This website is presented to you AS IS, with no warranty, express or implied. By proceeding you agree not to hold the owner(s) of the website responsible for any damages from your use of the website, and you understand that the content posted is not owned or generated by the website, but rather by the website's users.";

		if (!confirm(confirmText)) {
			//location.href = "about:blank";
			//return;
		} else {
			localStorage.setItem("termsAccepted", "true");
		}

	}

	// Really old browser. Run in noscript mode.
	// Check for browser compatibility by trying to detect some ES6 features
	function check(func) {
		try {
			return eval('(function(){' + func + '})()')
		}
		catch (e) {
			return false
		}
	}
	var es6Tests = [
		// Arrow functions
		'return (()=>5)()===5;',

		// Block scoped const
		'"use strict"; const bar = 123; {const bar = 456;} return bar===123;',

		// Block-scoped let
		'"use strict"; let bar = 123;{ let bar = 456; }return bar === 123;',

		// Computed object properties
		"var x='y';return ({ [x]: 1 }).y === 1;",

		// Shorthand object properties
		"var a=7,b=8,c={a,b};return c.a===7 && c.b===8;",

		// Template strings
		'var a = "ba"; return `foo bar${a + "z"}` === "foo barbaz";',

		// for...of
		'var arr = [5]; for (var item of arr) return item === 5;',

		// Spread operator
		'return Math.max(...[1, 2, 3]) === 3',

		// Class statement
		'"use strict"; class C {}; return typeof C === "function"',

		// Super call
		'"use strict"; var passed = false;'
		+ 'class B {constructor(a) { passed = (a === "barbaz")}};'
		+ 'class C extends B {constructor(a) {super("bar" + a)}};'
		+ 'new C("baz"); return passed;',

		// Default parameters
		'return (function (a = 1, b = 2) { return a === 3 && b === 2; }(3));',

		// Destructuring declaration
		'var [a,,[b],c] = [5,null,[6]];return a===5 && b===6 && c===undefined',

		// Parameter destructuring
		'return function([a,,[b],c]){return a===5 && b===6 && c===undefined;}'
		+ '([5,null,[6]])',

		// Generators
		'function * generator(){yield 5; yield 6};'
		+ 'var iterator = generator();'
		+ 'var item = iterator.next();'
		+ 'var passed = item.value === 5 && item.done === false;'
		+ 'item = iterator.next();'
		+ 'passed &= item.value === 6 && item.done === false;'
		+ 'item = iterator.next();'
		+ 'passed &= item.value === undefined && item.done === true;'
		+ 'return passed;'
	]
	for (var i = 0; i < es6Tests.length; i++) {
		if (!check(es6Tests[i])) {
			window.legacy = true
			break
		}
	}
	//if (!window.WebAssembly) {
	if (window.legacy) {
		var ns = document.getElementsByTagName("noscript");

		while (ns.length) { // Collection is live and changes with DOM updates
			var el = ns[0],
				cont = document.createElement("div");
			cont.innerHTML = el.innerHTML;
			el.parentNode.replaceChild(cont, el);
		}

		var bc = document.getElementById("banner-center");
		bc.classList.add("admin");
		bc.innerHTML = "UPDATE YOUR FUCKING BROWSER";
		return;
	}

	// Remove prefixes on Web Crypto API for Safari
	if (!checkFunction("window.crypto.subtle.digest")) {
		window.crypto.subtle = window.crypto.webkitSubtle;
	}

	// TODO: Uncomment for WASM client rewrite
	// var wasm = /[\?&]wasm=true/.test(location.search);

	var head = document.getElementsByTagName('head')[0];
	loadClient();

	// Check if a browser API function is defined
	function checkFunction(func) {
		try {
			// See comment on line 134
			return typeof eval(func) === 'function';
		} catch (e) {
			return false;
		}
	}

	function loadScript(path) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = '/assets/' + path + '.js';
		head.appendChild(script);
		return script;
	}

	function loadClient() {
		// Iterable NodeList
		if (!checkFunction('NodeList.prototype[Symbol.iterator]')) {
			NodeList.prototype[Symbol.iterator] =
				Array.prototype[Symbol.iterator];
		}

		// TODO: Uncomment for WASM client rewrite
		// if (wasm) {
		// 	window.Module = {};
		// 	fetch("/assets/wasm/main.wasm").then(function (res) {
		// 		return res.arrayBuffer();
		// 	}).then(function (bytes) {
		// 		// TODO: Parallel downloads of main.js and main.wasm
		// 		var script = document.createElement('script');
		// 		script.src = "/assets/wasm/main.js";
		// 		Module.wasmBinary = bytes;
		// 		document.head.appendChild(script);
		// 	});
		// } else {

		// polyfills
		Document.prototype.append || loadScript("js/scripts/polyfill-append-prepend");
		new URLSearchParams({q: "+"}).get('q') === "+" || loadScript("js/scripts/polyfill-url-search-params");

		// fast dirty hacks for users
		//loadScript("js/scripts/fasthacksforusers");

		// main script
		loadScript("js/main").onload = function () {
			require("main");
		};
		// }

		if ('serviceWorker' in navigator && (
			location.protocol === "https:" ||
			location.hostname === "localhost"
		)) {
			navigator.serviceWorker
				.register("/assets/js/scripts/worker.js", { scope: "/" })
				.catch(function (err) {
					throw err;
				});
		}
	}
})();
