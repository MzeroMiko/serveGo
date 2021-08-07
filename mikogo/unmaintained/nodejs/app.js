// use node.js
var http = require('http');
var url = require('url');
var fs = require('fs');

var confPath = __dirname + "/../config.json";
var setting = getConfig(confPath);
var dataPath = setting["dataPath"];
var authKey = setting["authKey"];
var httpPort = setting["httpPort"];
var callAddr = setting["callAddr"];
var sessionTime = Number(setting["sessionTime"]);

var monitor = new (require('./monitor'))();
var formFileParser = new (require('./formFileParser'))();
var fileProc = new (require('./fileProc'))({
    "sessionTime": sessionTime, "authKey": authKey, "homePage": __dirname + "/../public/home.html", 
    "trashDir": ".trash", "indexList": ["index.html", "index.htm", "index.php"],
});

var rootPath = __dirname + "/../public";
var maxFormMem = 5 * 1024 * 1024;

function getConfig(confPath) {
    var results =  fs.readFileSync(confPath);
    return JSON.parse(results);
}

function getRealPath(urlPath, targetPath, webPath) {
    // urlPath is rawurlencoded
    // return realpath: /Data/a, urlPath: %2FData%2Fa 
    if (webPath.slice(-1) == "/") webPath = webPath.slice(0, -1);
    if (targetPath.slice(-1) == "/") targetPath = targetPath.slice(0, -1);
    var oriPathList = urlPath.split("/");
    var pathList = [];
    var oriLength = oriPathList.length;
    for (var i = 0; i < oriLength; i++) {
        if (oriPathList[i].trim() == "..") pathList.pop();
        else if (oriPathList[i].trim() != "") pathList.push(oriPathList[i]);
    }
    pathLength = pathList.length;
    if (pathLength == 0){
        return { "realPath": targetPath + "/", "urlPath": encodeURIComponent("/") }
    } else {
        subPath = "";
        for (var i = 0; i < pathLength; i++) {
            subPath += "/" + pathList[i];
        }
        if (webPath != "" && subPath.indexOf(webPath) == 0) {
            subPath = subPath.slice(webPath.length);
        }
        return {
            "realPath": targetPath + subPath,
            "urlPath" : encodeURIComponent(webPath + subPath)
        }
    }
}

function call(Request, Response) {
    var query = url.parse(Request.url, true).query;
    var method = query["method"];
    if (typeof method == "undefined") {
        var qPath = query["path"];
        if (typeof qPath == "undefined" || qPath == "") {
            var target = url.parse(Request.url, true).pathname + "?path=/";
            fileProc.reDirect(302, target, Response);
            return;
        }
        var path = getRealPath(qPath, dataPath, "/");
        fileProc.sendStatic(true, path["realPath"], Request, Response);
        return;
    }
    switch (query["method"]) {
        case "monitor":
            Response.end(monitor.getInfo());
            break;
        case "getDir":
            var path = getRealPath(query["path"], dataPath, "/");
            Response.end(fileProc.readDirSync(path["realPath"]));
            break;
        case "getFile":
            var path = getRealPath(query["path"], dataPath, "/");
            fileProc.sendFile(true, path["realPath"], Request, Response);
            break;
        case "auth":
            Response.end(fileProc.postAuth(query["token"]));
            break;
        case "close":
            Response.end(fileProc.postClose(query["token"]));
            break;
        case "mkdir":
            var path = getRealPath(query["path"], dataPath, "/");
            Response.end(fileProc.postMkdir(query["token"], path["realPath"]));
            break;
        case "remove":
            var path = getRealPath(query["path"], dataPath, "/");
            Response.end(fileProc.postRemove(query["token"], path["realPath"]));
            break;
        case "rename":
            var path = getRealPath(query["path"], dataPath, "/");
            var newLink = decodeURIComponent(query["newLink"]);
            var newQuery = url.parse(newLink, true).query;
            var newPath = getRealPath(newQuery["path"], dataPath, "/");
            Response.end(fileProc.postRename(query["token"], path["realPath"], newPath["realPath"]));
            break;
        case "check":
            var path = getRealPath(query["path"], dataPath, "/");
            Response.end(fileProc.uploadCheck(query["token"], path["realPath"], query["fileMd5"], query["chunks"]));
            break;
        case "chunk":
            formFileParser.parse(Request, function (err, files) {
                if (err) {
                    Response.end(err);
                    return;
                }
                var buffer = files[0].buffer;
                var path = getRealPath(query["path"], dataPath, "/");
                Response.end(fileProc.uploadChunk(query["token"], path["realPath"], query["fileMd5"], query["current"], buffer));
            });
            break;
        case "merge":
            var path = getRealPath(query["path"], dataPath, "/");
            Response.end(fileProc.uploadMerge(query["token"], path["realPath"], query["fileMd5"], query["chunks"]));
            break;
        default:
            Response.end("action not supported");
    }
    // console.log(query);
}

function fileServer(localPath, webPath, Request, Response) {
    var path = getRealPath(url.parse(Request.url).pathname, localPath, webPath);
    fileProc.sendStatic(false, path["realPath"], Request, Response);
}

http.createServer(function (Request, Response) {
    var tmpURL = url.parse(Request.url).pathname;
    if (tmpURL.indexOf(callAddr) != -1) call(Request, Response);
    else fileServer(rootPath, "/", Request, Response);
}).listen(httpPort);
console.log(new Date().toString());
console.log('httpServer ( pid: ' + process.pid + ' ) starts at port: ' + httpPort);
