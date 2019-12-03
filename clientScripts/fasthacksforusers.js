(function () {

	var hiddenboardsRaw = localStorage.getItem("hiddenboards");
	if (hiddenboardsRaw !== null) {
		var hiddenboards = hiddenboardsRaw.split(",");
		var hiddenboards_mode = localStorage.getItem("hiddenboards_mode");
		if (hiddenboards_mode === null) {
			hiddenboards_mode = "deleted";
		}
		var boards = document.querySelectorAll(".board");
		for (var b = 0; b < boards.length; b++) {
			var boardname = boards[b].textContent;
			if (hiddenboards.includes(boardname)) {
				var header = boards[b].parentNode;
				if (hiddenboards_mode === "hide") {
					var control = header.querySelector(".control");
					control.click();
					var hideitem = control.querySelector('.popup-menu [data-id="hide"]');
					hideitem.click();
				} else {
					var article = header.parentNode;
					var section = article.parentNode;
					section.classList.add("deleted");
					section.classList.add("by-user");
				}
			}
		}
	}

})();