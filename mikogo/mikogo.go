package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"time"
	"sync"
	"strconv"
	"strings"
	"path/filepath"
	"encoding/json"
	"crypto/md5"
	"encoding/hex"
)

var confFile,  _ = filepath.Abs(os.Args[1])
var confPath = filepath.Dir(confFile)

var setting map[string]string = getConfig(confFile)
var authKey string = setting["authKey"]
var dataPath string = setting["dataPath"]
var sessionTime int = int(atoi(setting["sessionTime"]))
var homeConf map[string]string = getCallConf(setting["homeServe"])[0]
var redirectConf []map[string]string = getCallConf(setting["redirections"])
var homePage string = confPath + "/" + setting["homePage"]
var rootPath string = confPath + "/" + setting["rootPath"]
var httpsCrt string = confPath + "/" + setting["httpsCrt"]
var httpsKey string = confPath + "/" + setting["httpsKey"]

var monitor = &Monitor{}
var fileProc = newFileProc(FileProc{
	sessionTime: sessionTime, authKey: authKey, homePage: homePage, trashDir: ".trash",
	indexList: []string{"index.html", "index.htm", "index.php"},
})
var maxFormMem = 5 * 1024 * 1024 // max file memory 5M, the rest would be stored in tmp disk file

func getConfig(confFile string) map[string]string {
	var tmp map[string]string
	if results, err := ioutil.ReadFile(confFile); err == nil {
		fmt.Println(unjsonify(string(results), &tmp))
	}
	return tmp
}

func getURLQuery(urlStr string) map[string]string {
	var subURL, _ = url.Parse(urlStr)
	var query, _ = url.ParseQuery(subURL.RawQuery)
	var qMap = make(map[string]string)
	for key, val := range query {
		qMap[key] = strJoin(val, "")
	}
	return qMap
}

func getRealPath(urlPath, targetPath, webPath string) map[string]string {
	// urlPath is rawurlencoded
    // return realpath: /Data/a, urlPath: %2FData%2Fa 
	if strSlice(targetPath, -1, 0) == "/" {
		targetPath = strSlice(targetPath, 0, -1)
	}
	if strSlice(webPath, -1, 0) == "/" {
		webPath = strSlice(webPath, 0, -1)
	}
	var oriPathList = strSplit(decodeURIComponent(urlPath), "/")
	var pathList []string
	var oriLength = len(oriPathList)
	for i := 0; i < oriLength; i++ {
		if strTrim(oriPathList[i], " ") == ".." {
			pathList = append(pathList[0 : len(pathList)-1])
		} else if strTrim(oriPathList[i], " ") != "" {
			pathList = append(pathList, oriPathList[i])
		}
	}
    var pathLength = len(pathList)
	if pathLength == 0 {
		return map[string]string{"realPath": targetPath + "/", "urlPath": encodeURIComponent("/")} 
	} else {
		var subPath string
		for i := 0; i < pathLength; i++ {
            subPath += "/" + pathList[i]
        }
        if (webPath != "" && strIndex(subPath, webPath) == 0) {
            subPath = strSlice(subPath, len(webPath), 0)
		}
		return map[string]string{
			"realPath": targetPath + subPath, 
			"urlPath": encodeURIComponent(webPath + subPath),
			} 
	}
}

func getCallConf(callConfs string) [](map[string]string) {
	// "...": "https:9090:/cockpit, http:9091:/transmission"
	var results = make([](map[string]string), 0)
	var configs = strSplit(callConfs, ",")
	var configNum = len(configs)
	for i := 0; i < configNum; i++ {
		var config = strSplit(configs[i], ":")
		var protocal = config[0]
		var portPath = config[1] 
		var callPath = config[2]
		if portPath[0] != "/"[0] {
			portPath = ":" + portPath
		}
		if callPath[0] != "/"[0] {
			callPath = "/" + callPath
		}
		results = append(results, map[string]string{"protocal": protocal, "portPath": portPath, "callPath": callPath})
	}
	return results
}

func callMethods(Response http.ResponseWriter, Request *http.Request) {
	var query = getURLQuery(Request.URL.String())
	var method, ok = query["method"]
	if !ok {
		var qPath, ok = query["path"]
		if !ok || qPath == "" {
			var target = Request.URL.Path + "?path=/"
			fileProc.reDirect(302, target, Response)
			return
		}
		var path = getRealPath(query["path"], dataPath, "/")
		fileProc.sendStatic(true, path["realPath"], Request, Response)
		return
	}
	switch method {
	case "monitor":
		fmt.Fprintln(Response, monitor.getInfo())
	case "getDir":
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.readDirSync(path["realPath"]))
	case "getFile":
		var path = getRealPath(query["path"], dataPath, "/")
		fileProc.sendFile(true, path["realPath"], Request, Response)
	case "auth":
		fmt.Fprintln(Response, fileProc.postAuth(query["token"]))
	case "close":
		fmt.Fprintln(Response, fileProc.postClose(query["token"]))
	case "mkdir":
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.postMkdir(query["token"], path["realPath"]))
	case "remove":
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.postRemove(query["token"], path["realPath"]))
	case "rename":
		var path = getRealPath(query["path"], dataPath, "/")
		var newLink = decodeURIComponent(query["newLink"])
		var newQuery = getURLQuery(newLink)
		var newPath = getRealPath(newQuery["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.postRename(query["token"], path["realPath"], newPath["realPath"]))
	case "check":
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.uploadCheck(query["token"], path["realPath"], query["fileMd5"], query["chunks"]))
	case "chunk":
		Request.ParseMultipartForm(int64(maxFormMem))
		var formFile = Request.MultipartForm.File[query["current"]][0]
		var file, _ = formFile.Open()
		var buffer, _ = ioutil.ReadAll(file)
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.uploadChunk(query["token"], path["realPath"], query["fileMd5"], query["current"], buffer))
	case "merge":
		var path = getRealPath(query["path"], dataPath, "/")
		fmt.Fprintln(Response, fileProc.uploadMerge(query["token"], path["realPath"], query["fileMd5"], query["chunks"]))
	default:
		fmt.Fprintln(Response, "action not supported")
	}
}

func main() {
	http.HandleFunc(homeConf["callPath"], func(Response http.ResponseWriter, Request *http.Request) {
		callMethods(Response, Request)
	})

	for i := 0; i < len(redirectConf); i++ {
		var protocal = redirectConf[i]["protocal"]
		var portPath = redirectConf[i]["portPath"]
		var callPath = redirectConf[i]["callPath"]
		http.HandleFunc(callPath, func(Response http.ResponseWriter, Request *http.Request) {
			var host = Request.Host
			if strIndex(host, ":") != -1 {
				host = strSlice(host, 0, strIndex(host, ":"))
			}
			fileProc.reDirect(302, protocal + "://" + host + portPath, Response)
		})	
	}

	http.HandleFunc("/", func(Response http.ResponseWriter, Request *http.Request) {
		var path = getRealPath(Request.URL.Path, rootPath, "/")
		fileProc.sendStatic(false, path["realPath"], Request, Response)
	})

	var httpPort = homeConf["portPath"]
	fmt.Println(time.Now())
	fmt.Printf("go httpServer ( pid : %d ) starts at port %s with config file \"%s\"\n", os.Getpid(), httpPort, confFile)
	if homeConf["protocal"] == "https" {
		var err = http.ListenAndServeTLS(httpPort, httpsCrt, httpsKey, nil)
		if err != nil {
			panic("ListenAndServeTLS: " + err.Error())
		}
	} else {
		var err = http.ListenAndServe(httpPort, nil)
		if err != nil {
			panic("ListenAndServe: " + err.Error())
		}
	}

}


// ------------------------------ Object: fileProc ------------------------------------------------- //

// package main

// import (
// 	"crypto/md5"
// 	"encoding/hex"
// 	"io/ioutil"
// 	"net/http"
// 	"os"
// 	"time"
// 	"sync"
// 	// "fmt"
// )

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
	defer fp.Close()
	
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


// ------------------------------ Object: monitor ------------------------------------------------- //

// package main

// import (
// 	"io/ioutil"
// 	"os/exec"
// 	"time"
// 	// "fmt"
// )

type Monitor struct{}

// var must be Capital Letter start to Jsonfy
type infoType struct {
	CpuInfo, MemInfo, DiskInfo, Network, Uptime, Distro, Host, Version string
}

type cpuInfoType struct {
	Name, Core, Loadavg, Temperature, Idles, Totals string
}

type memInfoType struct {
	MemTotal, MemFree, Cached, Buffers, SwapTotal, SwapFree, SwapCached string
}

type diskInfoType struct {
	Usage, Detail string
}

type networkType struct {
	Dev, RxBytes, TxBytes string
}

var cpuInfo cpuInfoType
var memInfo memInfoType
var diskInfo diskInfoType
var network []networkType
var uptime, distro, host, version string

func execShell(str string) (string, string) {
	var stdout, err = exec.Command("sh", "-c", str).Output()
	if err == nil {
		return string(stdout), ""
	}
	return "", err.Error()
}

func timeHuman(time int64) string {
	var result = ""
	var timeS = int64(float64(time) + 0.5)
	var timeM = int64(float64(timeS) / 60)
	var timeH = int64(float64(timeM) / 60)
	var timeD = int64(float64(timeH) / 24)
	timeS = timeS - timeM*60
	timeM = timeM - timeH*60
	timeH = timeH - timeD*24
	result += itoa(int64(timeD)) + "d " + itoa(int64(timeH)) + "h "
	result += itoa(int64(timeM)) + "m " + itoa(int64(timeS)) + "s "
	return result
}

func getCpu() {
	if results, err := ioutil.ReadFile("/sys/class/thermal/thermal_zone0/temp"); err == nil {
		cpuInfo.Temperature = itoa(atoi(string(results)) / 1000)
	}
	if results, err := ioutil.ReadFile("/proc/loadavg"); err == nil {
		var load = strSplit(string(results), " ")
		cpuInfo.Loadavg = load[0] + " " + load[1] + " " + load[2]
	}
	if results, err := ioutil.ReadFile("/proc/cpuinfo"); err == nil {
		var info = strSplit(string(results), "\n")
		var cpuName = ""
		var cpuCore = 0
		for _, item := range info {
			if strIndex(item, "model name") == 0 {
				var tmp = strTrim(strSlice(item, strIndex(item, ":")+1, 0), " ")
				cpuCore++
				if strIndex(cpuName, tmp) == -1 {
					if cpuName != "" {
						cpuName += " | "
					}
					cpuName += tmp
				}
			}
		}
		cpuInfo.Name = cpuName
		cpuInfo.Core = itoa(int64(cpuCore))
	}
	if results, err := ioutil.ReadFile("/proc/stat"); err == nil {
		var tmpTotals, tmpIdles []string  
		var info = strSplit(string(results), "\n")
		for i:=0; i < len(info); i++ {
			if (strIndex(info[i], "cpu") == -1) {
				break;
			}
	        // cpu, cpu0, cpu1, ...
			var tmp = strSlice(info[i], strIndex(info[i], " "), 0)
			var tmpInfo = strSplit(strTrim(tmp, " "), " ")
			var tmpTotal int64 = 0
			tmpIdles = append(tmpIdles, tmpInfo[3])
			for i := 0; i < len(tmpInfo); i++ {
				tmpTotal += atoi(tmpInfo[i])
			}
			tmpTotals = append(tmpTotals, itoa(tmpTotal))
		}
		cpuInfo.Idles = jsonify(tmpIdles)
		cpuInfo.Totals = jsonify(tmpTotals)
	}
}

func getMem() {
	if results, err := ioutil.ReadFile("/proc/meminfo"); err == nil {
		var info = strSplit(string(results), "\n")
		for i := 0; i < len(info); i++ {
			var tmpInfo = info[i]
			if strIndex(tmpInfo, "MemTotal") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.MemTotal = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "MemFree") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.MemFree = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "Cached") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.Cached = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "Buffers") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.Buffers = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "SwapTotal") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.SwapTotal = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "SwapFree") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.SwapFree = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
			if strIndex(tmpInfo, "SwapCached") == 0 {
				var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, ":")+1, 0), " ")
				memInfo.SwapCached = strTrim(strSlice(tmp, 0, strIndex(tmp, " ")), " ")
			}
		}
	}
}

func getDisk() {
	var stdout, err = execShell("df -h 2>&1")
	if err == "" {
		diskInfo.Detail = stdout
		var info = strSplit(stdout, "\n")
		for i := 0; i < len(info); i++ {
			var tmp = strTrim(info[i], " ")
			if len(tmp) != 0 && strLastIndex(tmp, "/")+1 == len(tmp) {
				tmp = strSlice(tmp, 0, strLastIndex(tmp, "%"))
				diskInfo.Usage = strSlice(tmp, strLastIndex(tmp, " ")+1, 0)
				break
			}
		}
	}
}

func getNet() {
	if results, err := ioutil.ReadFile("/proc/net/dev"); err == nil {
		network = []networkType{}
		var info = strSplit(string(results), "\n")
		for i := 2; i < len(info); i++ {
			var tmp = strTrim(info[i], " ")
			if (tmp != "") {
				var tmpArr = strSplit(tmp, " ");
				network = append(network, networkType{strSlice(tmpArr[0], 0, -1), tmpArr[1], tmpArr[9]});
			}
		}
	}
}

func getUptime() {
	if results, err := ioutil.ReadFile("/proc/uptime"); err == nil {
		var info = strTrim(string(results), " ")
		info = strSplit(info, " ")[0]
		info = strSlice(info, 0, strIndex(info, "."))
		uptime = timeHuman(int64(atoi(info)))
	}
}

func getDistro() {
	if results, err := ioutil.ReadFile("/etc/issue"); err == nil {
		distro = string(results)
		distro = strSlice(distro, 0, strIndex(distro, "\\"))
	}
}

func getHost() {
	if results, err := ioutil.ReadFile("/etc/hostname"); err == nil {
		host = string(results)
	}
}

func getVersion() {
	if results, err := ioutil.ReadFile("/proc/version"); err == nil {
		version = string(results)
	}
}

var cTime int64 = 0
var minAskTime int64 = 3

func (this Monitor) getInfo() string {
	var tTime = time.Now().Unix() // seconds
	if tTime-cTime >= minAskTime {
		cTime = tTime
		getCpu()
		getMem()
		getDisk()
		getNet()
		getUptime()
		getDistro()
		getHost()
		getVersion()
	}
	var info infoType
	info.CpuInfo = jsonify(cpuInfo)
	info.MemInfo = jsonify(memInfo)
	info.DiskInfo = jsonify(diskInfo)
	info.Network = jsonify(network)
	info.Uptime = uptime
	info.Distro = distro
	info.Host = host
	info.Version = version
	return jsonify(info)
}


// ------------------------------ parts ------------------------------------------------- //

// package main

// import (
// 	"net/url"
// 	"strconv"
// 	"strings"
// 	"encoding/json"
// 	// "fmt"
// )

func encodeURIComponent(str string) string {
	// return url.PathEscape(str);
	var r = url.QueryEscape(str);
	return strings.Replace(r, "+", "%20", -1);
}

func decodeURIComponent(str string) string {
	var r, _ = url.PathUnescape(str);
	// var r, _ = url.QueryUnescape(str);
	return r;
}

func atoi(str string) int64 {
	if num, err := strconv.ParseInt(str, 10, 64); err == nil {
		return num;
	}
	return 0;
}

func itoa(num int64) string {
	return strconv.FormatInt(num, 10);
}

func strSplit(str string, sep string) []string {
	// strSplit("12  34    56    ", " ") return {12,34,56}
	// func (str string) split(sep string) []string  is not allowed
	// return strings.Split(str, sep) // it would return many "" strings
	var result = []string{}
	for {		
		str = strings.Trim(str, sep) // delete sep before and after string
		if str == "" { break; }
		// pos can not be 0 or len(str), cuz trim
		var pos = strings.Index(str, sep);
		if pos == -1 {
			result = append(result, str);
			break;
		} else {
			result = append(result, str[0:pos])
			str = str[pos: len(str)]
		}
	}
	return result
}

func strJoin(arr []string, sep string) string {
	return strings.Join(arr, sep)
}

func strTrim(str string, cutset string) string {
	return strings.Trim(str, cutset)
}

func strIndex(str string, substr string) int {
	var index = strings.Index(str, substr);
	if index == -1 {
		return -1; // not found
	} 
	return index;
}

func strLastIndex(str string, substr string) int {
	var index = strings.LastIndex(str, substr);
	if index == -1 {
		return -1; // not found
	} 
	return index;
}

func strSlice(str string, start int, stop int) string {
	// strSlice(str,1,0); strSlice(str,1,-1);
	var strlen = len(str);
	if (stop > strlen || start < -1*strlen) {
		return "";
	}
	if (start < 0) {
		start = start + strlen;
	}
	if (stop <= 0) {
		stop = stop + strlen;
	}
	if (start > stop) {
		return "";
	}
	return str[start:stop];
}

func jsonify(v interface{}) string {
	var bytes, err = json.Marshal(v);
	if (err == nil) {
		return string(bytes);
	}
	return err.Error();
}

func unjsonify(jsonStr string, v interface{}) string {
	// var str = `{"Name":"junbin", "Age":21, "Gender":true}`
	var err = json.Unmarshal([]byte(jsonStr), v);
	if (err == nil) {
		return "";
	}
	return err.Error();
}

