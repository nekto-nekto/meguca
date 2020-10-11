// FrontEnds for using the inbuilt post cache

package server

import (
	"net/http"
	"strconv"

	"github.com/bakape/meguca/cache"
	"github.com/bakape/meguca/db"
)

// Returns arguments for accessing the board page JSON/HTML cache
func boardCacheArgs(r *http.Request, board string, catalog bool, catalogMode uint8) (
	k cache.Key, f cache.FrontEnd,
) {
	var page int64
	if !catalog {
		p, err := strconv.ParseUint(r.URL.Query().Get("page"), 10, 64)
		if err == nil {
			page = int64(p)
		}
	}

	if catalog && catalogMode == 0 {
		k = cache.BoardKey(board, page, !catalog)
		f = cache.CatalogFE
	} else if catalog && catalogMode == 1 {
		k = cache.BoardKey(board, -1, !catalog) // dirty hack for dirty software
		f = cache.CatalogFEMod
	} else {
		k = cache.BoardKey(board, page, !catalog)
		f = cache.BoardPageFE
	}
	return
}

// Start cache upkeep proccesses. Requires a ready DB connection.
func listenToThreadDeletion() error {
	return db.Listen("thread_deleted", func(msg string) (err error) {
		board, id, err := db.SplitBoardAndID(msg)
		if err != nil {
			return
		}

		// Clear all cache records associated with a thread
		for _, i := range [...]int{0, 5, 100} {
			cache.Delete(cache.ThreadKey(id, i))
		}
		cache.DeleteByBoard(board)
		cache.DeleteByBoard("all")
		cache.DeleteByBoard("b")

		return nil
	})
}
