package main

import (
	"crypto/md5"
	"encoding/hex"
	"io/ioutil"
	"net/http"
	"os"
	"time"
	"sync"
	// "fmt"
)

type FileProc struct {
	indexList                                                                     []string
	sessionTime                                                                   int
	authKey, trashDir, homePage, authPass, authFail, signFail, signPass, signWarn string
	mimeSet                                                                       map[string]string
}

func newFileProc(ins FileProc) *FileProc {
	var instance = FileProc{
		indexList:   []string{"index.html", "index.htm", "index.php"},
		sessionTime: 10,
		authKey:     "123",
		trashDir:    ".trash",
		homePage:    "./home.html",
		authFail:    "authFail", authPass: "authPass",
		signFail: "fail", signWarn: "warn", signPass: "pass",
		mimeSet: map[string]string{
			"unknown": "",
			"css": "text/css", "gif": "image/gif", "html": "text/html",
			"php": "text/html", "ico": "image/x-icon", "jpeg": "image/jpeg",
			"jpg": "image/jpeg", "js": "text/javascript", "json": "application/json",
			"pdf": "application/pdf", "png": "image/png", "svg": "image/svg+xml",
			"swf": "application/x-shockwave-flash", "tiff": "image/tiff", "txt": "text/plain",
			"wav": "audio/x-wav", "wma": "audio/x-ms-wma", "wmv": "video/x-ms-wmv",
			"xml": "text/xml", "mp3": "audio/mpeg", "mp4": "video/mp4",
		},
	}
	if len(ins.indexList) != 0 {
		instance.indexList = ins.indexList
	}
	if ins.sessionTime > 0 {
		instance.sessionTime = ins.sessionTime
	}
	if ins.authKey != "" {
		instance.authKey = ins.authKey
	}
	if ins.homePage != "" {
		instance.homePage = ins.homePage
	}
	if ins.authPass != "" {
		instance.authPass = ins.authPass
	}
	if ins.authFail != "" {
		instance.authFail = ins.authFail
	}
	if ins.signPass != "" {
		instance.signPass = ins.signPass
	}
	if ins.signWarn != "" {
		instance.signWarn = ins.signWarn
	}
	if ins.signFail != "" {
		instance.signFail = ins.signFail
	}
	if len(ins.mimeSet) != 0 {
		instance.mimeSet = ins.mimeSet
	}
	return &instance
}

// file Server ============================================//
func (this FileProc) chooseType(realPath string) string {
	var suffix = strSlice(realPath, strLastIndex(realPath, ".")+1, 0)
	var mimeType, ok = this.mimeSet[suffix]
	if !ok {
		return this.mimeSet["unknown"]
	}
	return mimeType
}

func (this FileProc) parseRange(rangeStr string, filesize int64) [](map[string]int64) {
	// https://blog.csdn.net/thewindkee/article/details/80189434
	// Examples: 1.Range: bytes=1-499 (1-499 Bytes) 2.Range: bytes=-500 (last 500 Bytes)
	// 3. Range: bytes=500- (500-end Bytes) 4.Range: bytes=500-600,601-999
	// Res: Content-Range: bytes (unit first byte pos) - [last byte pos]/[entity length]
	// Examples: Content-Range: bytes 1-499/22400

	var results = make([](map[string]int64), 0)
	var start, end int64
	if strIndex(rangeStr, "=") == -1 || filesize <= 0 {
		return results
	}
	rangeStr = strSlice(rangeStr, strIndex(rangeStr, "=")+1, 0)
	var rangeList = strSplit(rangeStr, ",")
	// var start int64; var stop int64; var err error;
	for i := 0; i < len(rangeList); i++ {
		var rangeStr = strTrim(rangeList[i], " ")
		if strIndex(rangeStr, "-") == -1 {
			return results // not a correct rangeStr
		}
		var rangeStart = strTrim(strSlice(rangeStr, 0, strIndex(rangeStr, "-")), " ")
		var rangeEnd = strTrim(strSlice(rangeStr, strIndex(rangeStr, "-") + 1, 0), " ")
		if rangeStart == "" && rangeEnd == "" {
			start = 0
			end = filesize - 1
		} else if rangeStart == "" && rangeEnd != "" {
			start = filesize - atoi(rangeEnd)
			end = filesize - 1
		} else if rangeStart != "" && rangeEnd == "" {
			start = atoi(rangeStart)
			end = filesize - 1
		} else if rangeStart != "" && rangeEnd != "" {
			start = atoi(rangeStart)
			end = atoi(rangeEnd)
		}
		results = append(results, map[string]int64{"start": start, "end": end})
	}
	return results
}

func (this FileProc) sendFile(octet bool, realPath string, Request *http.Request, Response http.ResponseWriter) string {
	// console.log(Request.headers); // Request headers: lower litter char!
	var buffer = make([]byte, 4096) // read write buffer
	var start, end int64
	var stats, errStat = os.Stat(realPath)
	if errStat != nil {
		if (octet) {
			Response.WriteHeader(404)
			Response.Write(make([]byte, 0))
		}
		return errStat.Error()
	}
	if stats.IsDir() {
		if (octet) {
			Response.WriteHeader(404)
			Response.Write(make([]byte, 0))
		}
		return "Error: is Directory"
	}
	var fp, err = os.Open(realPath)
	if err != nil {
		if (octet) {
			Response.WriteHeader(404)
			Response.Write(make([]byte, 0))
		}
		return err.Error()
	}
	
	var fileName = strSlice(realPath, strLastIndex(realPath, "/")+1, 0)
	var fileSize = stats.Size()
	var LastModified = stats.ModTime().Format(time.RFC1123)
	var Etag = "W/\"" + itoa(fileSize) + "-" + itoa(stats.ModTime().Unix()) + "\""
	var contentType = this.chooseType(realPath)
	var contentDisposition = "filename=\"" + encodeURIComponent(fileName) + "\"; filename*=utf-8''" + encodeURIComponent(fileName);
	if octet {
		contentDisposition = "attachment;" + contentDisposition
	} 
	
	var modifiedSince = (Request.Header.Get("if-modified-since") == LastModified)
	var noneMatch = (Request.Header.Get("if-none-match") == Etag)
	if  modifiedSince || noneMatch  {
		Response.WriteHeader(304)
		Response.Write(make([]byte, 0))
		return ""
	}

	Response.Header().Set("Accpet-Ranges", "bytes")
	Response.Header().Set("Cache-Control", "public, max-age=0")
	Response.Header().Set("Last-Modified", LastModified)
	Response.Header().Set("Etag", Etag)
	Response.Header().Set("Content-Disposition", contentDisposition)
	if contentType != "" {
		Response.Header().Set("Content-type", contentType)
	} else {
		Response.Header().Set("Content-type", "application/octet-stream")
	}

	if Request.Header.Get("range") == "" {
		start = 0
		end = fileSize
		Response.Header().Set("Content-Length", itoa(fileSize))
		Response.WriteHeader(200)
	} else {
		var ranges = this.parseRange(Request.Header.Get("range"), fileSize)
		if len(ranges) == 0 { // has no range
			Response.WriteHeader(416)
			Response.Write(make([]byte, 0))
			return ""
		}
		// only trans the first
		start = ranges[0]["start"]
		end = ranges[0]["end"]
		Response.Header().Set("Content-Length", itoa(end-start+1))
		Response.Header().Set("Content-Range", "bytes "+itoa(start)+"-"+itoa(end)+"/"+itoa(fileSize))
		Response.WriteHeader(206)
	}
	fp.Seek(start, 0)
	for {
		buffer = make([]byte, 4096)
		var n, _ = fp.Read(buffer)
		if n == 0 {
			return ""
		} else if n < 4096 {
			buffer = buffer[0:n]
		}
		if _, err := Response.Write(buffer); err != nil {
			// when in range mode, connection may be reset by peer
			// fmt.Println(err.Error())
			return ""
		}
	}
}

func (this FileProc) scanIndex(realPath string) string {
	if strSlice(realPath, -1, 0) == "/" {
		realPath = strSlice(realPath, 0, -1)
	}
	var pageRank = -1
	var webPage = ""
	var dir, errOpen = os.Open(realPath)
	if errOpen != nil { 
		return webPage
	}
	defer dir.Close()
	var filenames, errRead = dir.Readdirnames(0) // <=0 is all
	if errRead != nil || len(filenames) == 0 {
		return webPage
	}
	for _, name := range filenames {
		var rank = strIndex(strJoin(this.indexList, " "), name)
		if rank != -1 && (pageRank == -1 || rank < pageRank) {
			pageRank = rank
			webPage = "./" + encodeURIComponent(name)
		}
	}
	return webPage
}

func (this FileProc) sendMessage(statusCode int, errInfo string, Response http.ResponseWriter) {
	// Response.WriteHeader() should be After Response.Header().Set();
	// Response.Write() should be After Response.Write();
	Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	Response.WriteHeader(statusCode)
	var htmlStr = "<div style=\"padding:48px;\">" + "<div style=\"font-weight:600;font-size:36px;word-break:break-word;\">" + errInfo + "</div></div>"
	Response.Write([]byte(htmlStr))
}

func (this FileProc) reDirect(statusCode int, target string, Response http.ResponseWriter) {
	Response.Header().Set("Location", target)
	Response.WriteHeader(statusCode)
	Response.Write(make([]byte, 0))
}

func (this FileProc) sendStatic(ignorePage bool, realPath string, Request *http.Request, Response http.ResponseWriter) {
	var err = this.sendFile(false, realPath, Request, Response)
	if err == "Error: is Directory" {
		if ignorePage {
			var err = this.sendFile(false, this.homePage, Request, Response)
			if err != "" {
				this.sendMessage(200, err, Response)
			}
			return
		}
		var webPage = this.scanIndex(realPath)
		if webPage == "" {
			var err = this.sendFile(false, this.homePage, Request, Response)
			if err != "" {
				this.sendMessage(200, err, Response)
			}
		} else {
			this.reDirect(302, webPage, Response)
		}
	} else if err != "" {
		this.sendMessage(404, err, Response)
	}
}

// read Dir ==============================================//
func (this FileProc) readDirSync(realPath string) string {
	type dirInfo struct { FileList, FolderList, Err string }
	type dirList struct { Name, Time, Size string }

	if strSlice(realPath, -1, 0) == "/" {
		realPath = strSlice(realPath, 0, -1)
	}
	var info dirInfo
	var fileList, folderList []dirList
	var dir, errOpen = os.Open(realPath)
	if errOpen != nil { 
		info.Err = errOpen.Error()
		return jsonify(info) 
	}
	defer dir.Close()
	var filenames, errRead = dir.Readdirnames(0) // <=0 is all
	if errRead != nil {
		info.Err = errRead.Error()
		return jsonify(info)
	}
	if len(filenames) == 0 {
		info.Err = "no file found"
		return jsonify(info)
	}
	for _, name := range filenames {
		var stat, err = os.Stat(realPath + "/" + name)
		if err != nil { continue } // maybe permission denied
		var list = dirList{encodeURIComponent(name), itoa(stat.ModTime().Unix()), itoa(int64(stat.Size()))}
		if stat.IsDir() {
			folderList = append(folderList, list)
		} else {
			fileList = append(fileList, list)
		}
	}
	info.FileList = jsonify(fileList)
	info.FolderList = jsonify(folderList)
	return jsonify(info)
}

// postAction ======================================================//
var ( 
	tokenLock sync.Mutex 
	tokenList = make(map[string]string) 
)

func (this *FileProc) md5Crypto(str string) string {
	var hash = md5.New()
	var _, err = hash.Write([]byte(str))
	if err != nil {
		return err.Error()
	}
	var cryStr = hex.EncodeToString(hash.Sum([]byte("")))
	return string(cryStr)
}

func (this FileProc) checkToken(token string, isAuth bool) string {
	tokenLock.Lock()
	defer tokenLock.Unlock()
	var now = int64(time.Now().Unix())
	if isAuth {
		if token != this.md5Crypto(this.authKey) {
			return this.authFail
		}
		var newKey = "time" + itoa(now)
		var newToken = this.md5Crypto("token" + newKey + "end")
		tokenList[newKey] = newToken
		return newToken
	}
	for key, oldToken := range tokenList {
		var time = atoi(strSlice(key, 4, 0));
		// fmt.Println(itoa(now), itoa(time), itoa(now - time));
		if (now - time) > int64(this.sessionTime*60) {
			delete(tokenList, key)
		} else if oldToken == token {
			delete(tokenList, key)
			var newKey = "time" + itoa(now)
			tokenList[newKey] = token
			return this.authPass
		}
	}
	return this.authFail
}

func (this FileProc) postAuth(token string) string {
	return this.checkToken(token, true)
}

func (this FileProc) postClose(token string) string {
	if this.checkToken(token, false) == this.authPass {
		for key, oldToken := range tokenList {
			if oldToken == token {
				delete(tokenList, key)
				return token
			}
		}
		return ""
	}
	return this.authFail
}

func (this FileProc) postMkdir(token, realPath string) string {
	if this.checkToken(token, false) == this.authPass {
		if _, err := os.Stat(realPath); err == nil || os.IsExist(err) {
			return "exist"
		}
		if err := os.MkdirAll(realPath, os.ModePerm); err == nil {
			return "pass"
		}
		return "fail"
	}
	return this.authFail
}

func (this FileProc) postRemove(token, realPath string) string {
	if this.checkToken(token, false) == this.authPass {
		var dirPath = strSlice(realPath, 0, strLastIndex(realPath, "/"))
		var name = strSlice(realPath, strLastIndex(realPath, "/") + 1, 0)
		var trashPath = dirPath + "/" + this.trashDir
		var trashFile = trashPath + "/" + name
		if strIndex(dirPath, this.trashDir) != -1 {
			return "exist"
		}
		if _, err := os.Stat(trashPath); !(err == nil || os.IsExist(err)) {
			if err:= os.MkdirAll(trashPath, os.ModePerm); err != nil {
				return "fail"
			}
		}
		if _, err := os.Stat(trashFile); err == nil || os.IsExist(err) {
			trashFile += "_" + itoa(time.Now().Unix())
		}
		if err := os.Rename(realPath, trashFile); err == nil {
			return "pass"
		}
		return "fail"
	}
	return this.authFail
}

func (this FileProc) postRename(token, oriPath, newPath string) string {
	if this.checkToken(token, false) == this.authPass {
		if _, err := os.Stat(newPath); err == nil || os.IsExist(err) {
			return "exist"
		}
		if err := os.Rename(oriPath, newPath); err == nil {
			return "pass"
		}
		return "fail"
	}
	return this.authFail
}

// upload ===================================================//
func (this FileProc) uploadCheck(token, realPath, fileMd5, chunksStr string) string {
	if this.checkToken(token, false) == this.authPass {
		var chunks = int(atoi(chunksStr))
		var result = make(map[string][]string)
		result["finished"] = make([]string, 0)
		result["exist"] = make([]string, 0) // not exist the file
		if _, err := os.Stat(realPath); err == nil || os.IsExist(err) {
			result["exist"] = append(result["exist"], "exist")
		}
		for i := 0; i < chunks; i++ {
			var fileNum = itoa(int64(i))
			var chunkPath = realPath + "_" + fileMd5 + "/" + fileNum + ".tmp"
			if _, err := os.Stat(chunkPath); err == nil || os.IsExist(err) {
				result["finished"] = append(result["finished"], fileNum)
			}
		}
		return jsonify(result)
	}
	return this.authFail
}

func (this FileProc) uploadMerge(token, realPath, fileMd5, chunksStr string) string {
	if this.checkToken(token, false) == this.authPass {
		var buf []byte
		var chunks = int(atoi(chunksStr))
		var outFile, err = os.OpenFile(realPath, os.O_CREATE|os.O_WRONLY, os.ModePerm)
		if err != nil {
			return this.signFail
		}
		for i := 0; i < chunks; i++ {
			var chunkPath = realPath + "_" + fileMd5 + "/" + itoa(int64(i)) + ".tmp"
			var inFile, err = os.OpenFile(chunkPath, os.O_RDONLY, os.ModePerm)
			if err != nil {
				return this.signFail
			}
			buf, err = ioutil.ReadAll(inFile)
			if err != nil {
				return this.signFail
			}
			outFile.Write(buf)
			inFile.Close()
		}
		for i := 0; i < chunks; i++ {
			var chunkPath = realPath + "_" + fileMd5 + "/" + itoa(int64(i)) + ".tmp"
			os.Remove(chunkPath)
		}
		os.Remove(realPath + "_" + fileMd5)
		outFile.Close()
		return this.signPass
	}
	return this.authFail
}

func (this FileProc) uploadChunk(token, realPath, fileMd5, currentStr string, content []byte) string {
	// content size should be limited
	if this.checkToken(token, false) == this.authPass {
		if _, err := os.Stat(realPath + "_" + fileMd5); !(err == nil || os.IsExist(err)) {
			if err:= os.MkdirAll(realPath + "_" + fileMd5, os.ModePerm); err != nil {
				return "fail"
			}
		}
		var chunkPath = realPath + "_" + fileMd5 + "/" + currentStr + ".tmp"
		if ioutil.WriteFile(chunkPath, content, 0644) == nil {
			return this.signPass
		}
		return this.signFail
	}
	return this.authFail
}
