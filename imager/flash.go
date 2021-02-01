package imager

import (
	"bytes"
)

const (
	mimeSWF = "application/vnd.adobe.flash-movie"
)

func detectFlash(buf []byte) (mime string, ext string) {
	if bytes.HasPrefix(buf, []byte("CWS")) || bytes.HasPrefix(buf, []byte("FWS")) {
		mime = mimeSWF
		ext = "swf"
	}
	return
}
