package server

import (
	"meguca/auth"
	"meguca/cache"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/templates"
	"net/http"
)

// Apply headers and write HTML to client
func serveHTML(
	w http.ResponseWriter,
	r *http.Request,
	etag string,
	data []byte,
	err error,
) {
	if err != nil {
		text500(w, r, err)
		return
	}
	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	if etag != "" {
		head.Set("ETag", etag)
	}
	head.Set("Content-Type", "text/html")
	head.Set("Service-Worker-Allowed", "/")

	writeData(w, r, data)
}

// Client is requesting the new wasm page
func isWasm(r *http.Request) bool {
	return r.URL.Query().Get("wasm") == "true"
}

// Serves board HTML to regular or noscript clients
func boardHTML(w http.ResponseWriter, r *http.Request, b string, catalog bool) {
	if !auth.IsBoard(b) {
		text404(w)
		return
	}
	if !assertNotBanned(w, r, b) {
		return
	}

	theme := resolveTheme(r, b)
	if isWasm(r) {
		serveHTML(w, r, "", templates.WasmIndex(theme), nil)
		return
	}

	html, data, ctr, err := cache.GetHTML(boardCacheArgs(r, b, catalog))
	switch err {
	case nil:
	case cache.ErrPageOverflow:
		text404(w)
		return
	default:
		text500(w, r, err)
		return
	}

	pos, ok := extractPosition(w, r)
	if !ok {
		return
	}

	_, hash := config.GetClient()
	etag := formatEtag(ctr, hash, pos)
	if checkClientEtag(w, r, etag) {
		return
	}

	var n, total int
	if !catalog {
		p := data.(cache.PageStore)
		n = p.PageNumber
		total = p.Data.Pages
	}

	html = templates.Board(
		b, theme,
		n, total,
		pos,
		r.URL.Query().Get("minimal") == "true", catalog,
		html,
	)
	serveHTML(w, r, etag, html, nil)
}

// Resolve theme to render in accordance to client and board settings.
// Needed to prevent Flash Of Unstyled Content.
func resolveTheme(r *http.Request, board string) string {
	if c, err := r.Cookie("theme"); err == nil {
		for _, t := range common.Themes {
			if c.Value == t {
				return c.Value
			}
		}
	}
	if board == "all" {
		return config.Get().DefaultCSS
	}
	return config.GetBoardConfigs(board).DefaultCSS
}

// Asserts a thread exists on the specific board and renders the index template
func threadHTML(w http.ResponseWriter, r *http.Request) {
	id, ok := validateThread(w, r)
	if !ok {
		return
	}

	b := extractParam(r, "board")
	theme := resolveTheme(r, b)
	if isWasm(r) {
		serveHTML(w, r, "", templates.WasmIndex(theme), nil)
		return
	}

	lastN := detectLastN(r)
	k := cache.ThreadKey(id, lastN)
	html, data, ctr, err := cache.GetHTML(k, cache.ThreadFE)
	if err != nil {
		respondToJSONError(w, r, err)
		return
	}

	pos, ok := extractPosition(w, r)
	if !ok {
		return
	}

	_, hash := config.GetClient()
	etag := formatEtag(ctr, hash, pos)
	if checkClientEtag(w, r, etag) {
		return
	}

	thread := data.(common.Thread)
	html = templates.Thread(
		id,
		b, thread.Subject, theme,
		lastN != 0, thread.Locked,
		pos,
		html,
	)
	serveHTML(w, r, etag, html, nil)
}

// Extract logged in position for HTML request.
// If ok == false, caller should return.
func extractPosition(w http.ResponseWriter, r *http.Request) (
	pos auth.ModerationLevel, ok bool,
) {
	ok = true
	pos = auth.NotLoggedIn
	creds := extractLoginCreds(r)
	if creds.UserID == "" {
		return
	}

	loggedIn, err := db.IsLoggedIn(creds.UserID, creds.Session)
	switch err {
	case common.ErrInvalidCreds:
		return
	case nil:
		if loggedIn {
			board := extractParam(r, "board")
			pos, err = db.FindPosition(board, creds.UserID)
			if err != nil {
				text500(w, r, err)
				ok = false
				return
			}
		}
	default:
		text500(w, r, err)
		ok = false
		return
	}

	return
}

// Render a board selection and navigation panel and write HTML to client
func boardNavigation(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.BoardNavigation)
}

// Execute a simple template, that accepts no arguments
func staticTemplate(
	w http.ResponseWriter,
	r *http.Request,
	fn func() string,
) {
	serveHTML(w, r, "", []byte(fn()), nil)
}

// Serve a form for selecting one of several boards owned by the user
func ownedBoardSelection(w http.ResponseWriter, r *http.Request) {
	userID := extractParam(r, "userID")
	owned, err := db.GetOwnedBoards(userID)
	if err != nil {
		text500(w, r, err)
		return
	}

	// Retrieve titles of boards
	ownedTitles := make(config.BoardTitles, 0, len(owned))
	for _, b := range config.GetBoardTitles() {
		for _, o := range owned {
			if b.ID == o {
				ownedTitles = append(ownedTitles, b)
				break
			}
		}
	}

	serveHTML(w, r, "", []byte(templates.OwnedBoard(ownedTitles)), nil)
}

// Renders a form for configuring a board owned by the user
func boardConfigurationForm(w http.ResponseWriter, r *http.Request) {
	conf, isValid := boardConfData(w, r)
	if !isValid {
		return
	}

	serveHTML(w, r, "", []byte(templates.ConfigureBoard(conf)), nil)
}

// Render a form for assigning staff to a board
func staffAssignmentForm(w http.ResponseWriter, r *http.Request) {
	s, err := db.GetStaff(extractParam(r, "board"))
	if err != nil {
		text500(w, r, err)
		return
	}
	html := []byte(templates.StaffAssignment(
		[...][]string{s["owners"], s["moderators"], s["janitors"]},
	))
	serveHTML(w, r, "", html, nil)
}

// Renders a form for creating new boards
func boardCreationForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.CreateBoard)
}

// Render the form for configuring the server
func serverConfigurationForm(w http.ResponseWriter, r *http.Request) {
	if !isAdmin(w, r) {
		return
	}

	data := []byte(templates.ConfigureServer((*config.Get())))
	serveHTML(w, r, "", data, nil)
}

// Render a form to change an account password
func changePasswordForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.ChangePassword)
}

// Render a form with nothing but captcha and confirmation buttons
func renderCaptcha(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.CaptchaConfirmation)
}

// Render a link to request a new captcha
func noscriptCaptchaLink(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.NoscriptCaptchaLink)
}

func bannerSettingForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.BannerForm)
}

func loadingAnimationForm(w http.ResponseWriter, r *http.Request) {
	staticTemplate(w, r, templates.LoadingAnimationForm)
}

// Render the captcha for noscript browsers
func noscriptCaptcha(w http.ResponseWriter, r *http.Request) {
	ip, err := auth.GetIP(r)
	if err != nil {
		text400(w, err)
		return
	}
	serveHTML(w, r, "", []byte(templates.NoscriptCaptcha(ip)), nil)
}
