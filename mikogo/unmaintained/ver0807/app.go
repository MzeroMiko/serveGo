package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"time"
	"path/filepath"
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


