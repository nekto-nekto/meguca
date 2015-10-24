/*
 Various utility functions used all over the place
 */

const _ = require('underscore'),
	imports = require('./imports');

function is_pubsub(t) {
	return t > 0 && t < 30;
}
exports.is_pubsub = is_pubsub;

// Finite State Machine
function FSM(start) {
	this.state = start;
	this.spec = {
		acts: {},
		ons: {},
		wilds: {},
		preflights: {}
	};
}
exports.FSM = FSM;

FSM.prototype.clone = function() {
	let second = new FSM(this.state);
	second.spec = this.spec;
	return second;
};

// Handlers on arriving to a new state
FSM.prototype.on = function(key, f) {
	let ons = this.spec.ons[key];
	if (ons)
		ons.push(f);
	else
		this.spec.ons[key] = [f];
	return this;
};

// Sanity checks before attempting a transition
FSM.prototype.preflight = function(key, f) {
	let pres = this.spec.preflights[key];
	if (pres)
		pres.push(f);
	else
		this.spec.preflights[key] = [f];
};

// Specify transitions and an optional handler function
FSM.prototype.act = function(trans_spec, on_func) {
	const halves = trans_spec.split('->');
	if (halves.length != 2)
		throw new Error("Bad FSM spec: " + trans_spec);
	const parts = halves[0].split(',');
	let dest = halves[1].match(/^\s*(\w+)\s*$/)[1],
		tok;
	for (let i = parts.length - 1; i >= 0; i--) {
		let part = parts[i];
		const m = part.match(/^\s*(\*|\w+)\s*(?:\+\s*(\w+)\s*)?$/);
		if (!m)
			throw new Error("Bad FSM spec portion: " + part);
		if (m[2])
			tok = m[2];
		if (!tok)
			throw new Error("Tokenless FSM action: " + part);
		const src = m[1];
		if (src == '*')
			this.spec.wilds[tok] = dest;
		else {
			let acts = this.spec.acts[src];
			if (!acts)
				this.spec.acts[src] = acts = {};
			acts[tok] = dest;
		}
	}
	if (on_func)
		this.on(dest, on_func);
	return this;
};

FSM.prototype.feed = function(ev, param) {
	const spec = this.spec;
	let from = this.state, acts = spec.acts[from];
	const to = (acts && acts[ev]) || spec.wilds[ev];
	if (to && from != to) {
		let ps = spec.preflights[to];
		for (let i = 0; ps && i < ps.length; i++) {
			if (!ps[i].call(this, param))
				return false;
		}
		this.state = to;
		let fs = spec.ons[to];
		for (let i = 0; fs && i < fs.length; i++)
			fs[i].call(this, param);
	}
	return true;
};

FSM.prototype.feeder = function(ev) {
	let self = this;
	return function(param) {
		self.feed(ev, param);
	};
};

function escape_fragment(frag) {
	var t = typeof (frag);
	if (t == 'object' && frag && typeof (frag.safe) == 'string')
		return frag.safe;
	else if (t == 'string')
		return _.escape(frag);
	else if (t == 'number')
		return frag.toString();
	else
		return '???';
}
exports.escape_fragment = escape_fragment;

function flatten(frags) {
	let out = [];
	for (let i = 0, l = frags.length; i < l; i++) {
		let frag = frags[i];
		if (Array.isArray(frag))
			out = out.concat(flatten(frag));
		else if (frag || frag === 0)
			out.push(escape_fragment(frag));
	}
	return out;
}
exports.flatten = flatten;

// Produce HTML out of an array generated by an OneeSama instance
function join(func) {
	return flatten(func).join('');
}
exports.join = join;

// Wraps safe strings, which will not be escaped on cocatenation
function safe(frag) {
	return {safe: frag};
}
exports.safe = safe;

function is_sage(email) {
	return imports.hotConfig.SAGE_ENABLED
		&& email
		&& email.trim() === 'sage';
}
exports.is_sage = is_sage;

// Construct hash command regex pattern
var dice_re = '(#flip|#8ball|#sw(?:\\d{1,2}:)?\\d{1,2}:\\d{1,2}(?:[+-]\\d+)?' +
	'|#\\d{0,2}d\\d{1,4}(?:[+-]\\d{1,4})?';
if (imports.config.PYU)
	dice_re += '|#pyu|#pcount';
if (imports.config.RADIO)
	dice_re += '|#q';
dice_re += ')';
dice_re = new RegExp(dice_re, 'i');
exports.dice_re = dice_re;

function parse_dice(frag) {
	switch (frag) {
		case '#flip':
			return {n: 1, faces: 2};
		case '#8ball':
			return {n: 1, faces: imports.hotConfig.EIGHT_BALL.length};
		case '#pyu':
			return {type: 'pyu', increment: true};
		case '#pcount':
			return {type: 'pyu'};
		case '#q':
			return {type: 'radioQueue'};
		default:
			return parseRegularDice(frag) || parseSyncwatch(frag);
	}
}
exports.parse_dice = parse_dice;

function parseRegularDice(frag) {
	const m = frag.match(/^#(\d*)d(\d+)([+-]\d+)?$/i);
	if (!m)
		return false;
	const n = parseInt(m[1], 10) || 1,
		faces = parseInt(m[2], 10);
	if (n < 1 || n > 10 || faces < 2 || faces > 100)
		return false;
	let info = {
		n: n,
		faces: faces
	};
	if (m[3])
		info.bias = parseInt(m[3], 10);
	return info;
}

function parseSyncwatch(frag) {
	// First capture group may or may not be present
	const sw = frag.match(/^#sw(\d+:)?(\d+):(\d+)([+-]\d+)?$/i);
	if (!sw)
		return false;
	const hour = parseInt(sw[1], 10) || 0,
		min = parseInt(sw[2], 10),
		sec = parseInt(sw[3], 10);
	let start = serverTime();
	// Offset the start. If the start is in the future, a countdown will be
	// displayed.
	if (sw[4]) {
		const symbol = sw[4].slice(0, 1),
			offset = sw[4].slice(1) * 1000;
		start = symbol == '+' ? start + offset : start - offset;
	}
	const end = ((hour * 60 + min) * 60 + sec) * 1000 + start;

	return {hour, min, sec, start, end, type: 'syncwatch'};
}

let cachedOffset;
function serverTime() {
	const d = Date.now();
	if (imports.isNode)
		return d;

	// The offset is intialised as 0, so there is something to return, until
	// we get a propper number from the server.
	if (!cachedOffset)
		cachedOffset = imports.main.request('time:offset');
	return d + cachedOffset;
}
exports.serverTime = serverTime;

function readable_dice(bit, dice) {
	let inner;
	switch (bit) {
		case '#flip':
			inner = (dice[2] == 2).toString();
			break;
		case '#8ball':
			inner = imports.hotConfig.EIGHT_BALL[dice[2] - 1];
			break;
		case '#pyu':
		case '#pcount':
		case '#q':
			inner = dice[0];
			break;
	}
	if (inner !== undefined)
		return _.escape(`${bit} (${inner})`);
	if (/^#sw/.test(bit))
		return readableSyncwatch(dice[0]);
	return readableRegularDice(bit, dice);
}
exports.readable_dice = readable_dice;

function readableSyncwatch(dice) {
	dice.class = 'embed';
	return parseHTML
		`<syncwatch ${dice}>
			syncwatch
		</syncwatch>`;
}

function readableRegularDice(bit, dice) {
	const bias = dice[1],
		rolls = dice.slice(2),
		n = rolls.length;
	bit += ' (';
	const eq = n > 1 || bias;
	if (eq)
		bit += rolls.join(', ');
	if (bias)
		bit += (bias < 0 ? ' - ' + (-bias) : ' + ' + bias);
	let sum = bias;
	for (var j = 0; j < n; j++) {
		sum += rolls[j];
	}

	return _.escape(bit + (eq ? ' = ' : '') + sum + ')');
}

function pick_spoiler(metaIndex) {
	const imgs = imports.config.SPOILER_IMAGES,
		n = imgs.length;
	let i;
	if (metaIndex < 0)
		i = Math.floor(Math.random() * n);
	else
		i = metaIndex % n;
	return {
		index: imgs[i],
		next: (i + 1) % n
	};
}
exports.pick_spoiler = pick_spoiler;

exports.thumbStyles = ['small', 'sharp', 'hide'];

function readable_filesize(size) {
	/* Dealt with it. */
	if (size < 1024)
		return size + ' B';
	if (size < 1048576)
		return Math.round(size / 1024) + ' KB';
	size = Math.round(size / 104857.6).toString();
	return size.slice(0, -1) + '.' + size.slice(-1) + ' MB';
}
exports.readable_filesize = readable_filesize;

function pad(n) {
	return (n < 10 ? '0' : '') + n;
}
exports.pad = pad;

// Various UI-related links wrapped in []
function action_link_html(href, name, id, cls) {
	return parseHTML
		`<span class="act">
			<a href="${href}"
				${id && ` id="${id}"`}
				${cls && ` class="${cls}"`}
			>
				${name}
			</a>
		</span>`;
}
exports.action_link_html = action_link_html;

function reasonable_last_n(n) {
	return Number.isInteger(n) && n >= 5 && n <= 500;
}
exports.reasonable_last_n = reasonable_last_n;

function parse_name(name) {
	var tripcode = '', secure = '';
	var hash = name.indexOf('#');
	if (hash >= 0) {
		tripcode = name.substr(hash + 1);
		name = name.substr(0, hash);
		hash = tripcode.indexOf('#');
		if (hash >= 0) {
			secure = _.escape(tripcode.substr(hash + 1));
			tripcode = tripcode.substr(0, hash);
		}
		tripcode = _.escape(tripcode);
	}
	name = name.trim().replace(imports.hotConfig.EXCLUDE_REGEXP, '');
	return [
		name.substr(0, 100), tripcode.substr(0, 128),
		secure.substr(0, 128)
	];
}
exports.parse_name = parse_name;

function randomID(len) {
	let id = ''
	for (let i = 0; i < len; i++) {
		let char = (Math.random() * 36).toString(36)[0]
		if (Math.random() < 0.5)
			char = char.toUpperCase()
		id += char
	}
	return id
}
exports.randomID = randomID

function random(array) {
	return array[Math.floor(Math.random() * array.length)];
}
exports.random = random;

/*
 Template string tag function for HTML. Strips indentation and trailing
 newlines. Based on https://gist.github.com/zenparsing/5dffde82d9acef19e43c
 */
function parseHTML(callSite) {
	// if argumennts.length === 1
	if (typeof callSite === 'string')
		return formatHTML(callSite);
	if (typeof callSite === 'function')
		return formatHTML(callSite(args));

	/*
	 Slicing the arguments object is deoptimising, so we construct a new array
	 instead.
	 */
	const len = arguments.length;
	let args = [];
	for (let i = 1; i < len; i++) {
		args[i - 1] = arguments[i];
	}

	const output = callSite
		.slice(0, len)
		.map(function (text, i) {
			const arg = args[i - 1];
			let result;
			/*
			 Simplifies conditionals. If the placeholder returns a non-zero
			 falsy value, it is ommitted.
			 */
			if (i === 0 || (!arg && arg !== 0))
				result = '';
			else if (arg instanceof Object)
				result = elementAttributes(arg);
			else
				result = arg;

			return result + text;
		})
		.join('');

	return formatHTML(output);
}
exports.parseHTML = parseHTML;

function formatHTML(str) {
	let size = -1;
	return str
		.replace(/\n(\s+)/g, function(m, m1) {
			if (size < 0)
				size = m1.replace(/\t/g, '    ').length;
			return m1.slice(Math.min(m1.length, size));
		})
		// Remove empty lines
		.replace(/^\s*\n/gm, '');
}

// Generate an HTML element attribute list
function elementAttributes(attrs) {
	let html = '';
	for (let key in attrs) {
		html += ' ';
		const val = attrs[key];
		if (val === true)
			html += key;
		else if (val || val === 0)
			html += `${key}="${val}"`;
	}
	return html;
}

// Makes a ', ' seperated list out of on array of strings
function commaList(items) {
	let html = '';
	for (let item of items) {
		// Falsy value. Skip item.
		if (!item && item !== 0)
			continue;
		if (html)
			html += ', ';
		html += item;
	}
	return html;
}
exports.commaList = commaList;

// Acertains client has the proper authorisation level or higher
function checkAuth(type, ident) {
	const levels = ['janitor', 'moderator', 'admin'];
	return levels.indexOf(type) <= levels.indexOf(ident.auth);
}
exports.checkAuth = checkAuth;
