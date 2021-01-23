package db

import (
	"database/sql"

	"github.com/Masterminds/squirrel"
	"github.com/bakape/meguca/auth"
	"github.com/bakape/meguca/config"
	"github.com/go-playground/log"
)

// Report a post for rule violations
func Report(id uint64, board, reason, ip string, illegal bool) error {
	// If the reported content is illegal, log an error so it will email
	if illegal {
		log.Errorf(
			"Illegal content reported\nPost: %s/all/%d\nReason: %s\nIP: %s",
			config.Get().RootURL, id, reason, ip)
	}

	_, err := sq.Insert("reports").
		Columns("target", "board", "reason", "by", "illegal").
		Values(id, board, reason, ip, illegal).
		Exec()

	return err
}

// GetReports reads reports for a specific board. Pass "all" for global reports.
func GetReports(board string) (rep []auth.Report, err error) {
	tmp := auth.Report{
		Board: board,
	}
	rep = make([]auth.Report, 0, 64)

	var query squirrel.SelectBuilder
	if board == "all" || board == "" {
		query = sq.Select("id", "target", "board", "reason", "illegal", "created").
			From("reports").
			OrderBy("created desc")
	} else {
		query = sq.Select("id", "target", "board", "reason", "illegal", "created").
			From("reports").
			Where("board = ?", board).
			OrderBy("created desc")
	}
	err = queryAll(
		query,
		func(r *sql.Rows) (err error) {
			err = r.Scan(&tmp.ID, &tmp.Target, &tmp.Board, &tmp.Reason, &tmp.Illegal, &tmp.Created)
			if err != nil {
				return
			}
			rep = append(rep, tmp)
			return
		},
	)
	return
}
