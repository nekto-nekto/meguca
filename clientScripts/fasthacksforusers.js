function ready(fn) { if (document.readyState != 'loading'){ fn(); } else if (document.addEventListener) { document.addEventListener('DOMContentLoaded', fn); } else { document.attachEvent('onreadystatechange', function() { if (document.readyState != 'loading') fn(); }); } };

(function () {

	// hide boards
	var hiddenboardsRaw = localStorage.getItem("hiddenboards");
	if (hiddenboardsRaw !== null) {
		var hiddenboards = hiddenboardsRaw.split(",");
		/*var hiddenboards_mode = localStorage.getItem("hiddenboards_mode");
		if (hiddenboards_mode === null) {
			hiddenboards_mode = "deleted";
		}*/
		ready(function() {
			var boards = document.querySelectorAll(".board");
			for (var b = 0; b < boards.length; b++) {
				var boardname = boards[b].textContent;
				if (hiddenboards.includes(boardname)) {
					var header = boards[b].parentNode;
					/*if (hiddenboards_mode === "hide") {
						var control = header.querySelector(".control");
						control.click();
						var hideitem = control.querySelector('.popup-menu [data-id="hide"]');
						hideitem.click();
					} else {*/
						var article = header.parentNode;
						var section = article.parentNode;
						section.classList.add("deleted");
						section.classList.add("by-user");
					//}
				}
			}
		});
	}

	// forcing hide hidden post on load
	
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB, IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
	var dbVersion = 12;
	var dbName = "meguca";
	var request = indexedDB.open(dbName);
	var db, transaction, objectStore;
	var hiddenPostsSelector = "";
	var hidePostInterval;
	var dbExists = true;
	request.onupgradeneeded = function(e) {
		if(request.result.version===1){
			dbExists = false;
			window.indexedDB.deleteDatabase(dbName);
		}
	}
	request.onsuccess = function (event) {
		if (dbExists) {
			db = request.result;
			db.onerror = function (event) {
				console.error("Error accessing IndexedDB database");
			}
			transaction = db.transaction(["hidden"], "readonly");
			transaction.onerror = function(event) {
				console.error(event);
			};
			objectStore = transaction.objectStore("hidden");
			request = objectStore.getAll();
			request.onsuccess = function(event) {
				var hiddenPosts = event.target.result;
				for (var i = 0; i < hiddenPosts.length; i++) {
					var hiddenPost = hiddenPosts[i];
					if (hiddenPost.op == hiddenPost.id) {
						hiddenPostsSelector += 'section.index-thread[data-id="' + hiddenPost.id + '"] article';
					} else {
						hiddenPostsSelector += 'article[id="p$' + hiddenPost.id + '"]';
					}
					if (i < hiddenPosts.length-1) {
						hiddenPostsSelector += ", ";
					}
				}
				var posthideFunc = function() {
					if (hiddenPostsSelector !== "") {
						var postforhide = document.querySelectorAll(hiddenPostsSelector);
						postforhide.forEach(function(element) {
							element.classList.add("hidden");
						});
					}
				}
				posthideFunc();
				hidePostInterval = setInterval(posthideFunc, 50);
			}
		} else {
			request.result.close();
		}
	}
	request.onerror = function(event) {
		console.error("error", event);
	}

	document.addEventListener("readystatechange", function (event) {
		if (event.target.readyState === "complete") {
			clearInterval(hidePostInterval);
			var clearIntervalFunc = setInterval(function() {
				clearInterval(hidePostInterval);
				clearInterval(clearIntervalFunc);
			}, 100);
		}
	});
})();
