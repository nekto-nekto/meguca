(function () {

	let hiddenboardsRaw = localStorage.getItem("hiddenboards");
	if (hiddenboardsRaw !== null) {
		let hiddenboards = hiddenboardsRaw.split(",");
		let hiddenboards_mode = localStorage.getItem("hiddenboards_mode");
		if (hiddenboards_mode === null) {
			hiddenboards_mode = "deleted";
		}
		var boards = document.querySelectorAll(".board");
		for (let b = 0; b < boards.length; b++) {
			let boardname = boards[b].textContent;
			if (hiddenboards.includes(boardname)) {
				let header = boards[b].parentNode;
				if (hiddenboards_mode === "hide") {
					let control = header.querySelector(".control");
					control.click();
					let hideitem = control.querySelector('.popup-menu [data-id="hide"]');
					hideitem.click();
				} else {
					let article = header.parentNode;
					let section = article.parentNode;
					section.classList.add("deleted");
					section.classList.add("by-user")
				}
			}
		}
	}

})();