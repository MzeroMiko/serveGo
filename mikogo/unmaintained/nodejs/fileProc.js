/*
 * use fs, crypto (written by Mzero for MikoSite, MIT Licence), http(Request, Response)
 * written by Mzero for MikoSite, MIT License
 * recv Action(auth, mkdir, mv, rm, close), recv File  
 */
var fs = require('fs');
var crypro = require('crypto');

module.exports = function fileProc(opts) {
    if (typeof opts == "undefined") opts = {};
    var indexList = ("indexList" in opts) ? opts.indexList : ["index.html", "index.htm", "index.php"];
    var sessionTime = ("sessionTime" in opts) ? opts.sessionTime : 10;
    var authKey = ("authKey" in opts) ? opts.authKey : "123";
    var trashDir = ("trashDir" in opts) ? opts.trashDir : ".trash";
    var homePage = ("homePage" in opts) ? opts.homePage : "./home.html";
    var authPass = ("authPass" in opts) ? opts.authPass : "authPass";
    var authFail = ("authFail" in opts) ? opts.authFail : "authFail";
    var signFail = ("signFail" in opts) ? opts.signFail : "fail";
    var signWarn = ("signWarn" in opts) ? opts.signWarn : "warn";
    var signPass = ("signPass" in opts) ? opts.signPass : "pass";
    var mimeSet = ("mimeSet" in opts) ? opts.mimeSet : {
        "unknown": "",
        "css": "text/css", "gif": "image/gif", "html": "text/html",
        "php": "text/html", "ico": "image/x-icon", "jpeg": "image/jpeg",
        "jpg": "image/jpeg", "js": "text/javascript", "json": "application/json",
        "pdf": "application/pdf", "png": "image/png", "svg": "image/svg+xml",
        "swf": "application/x-shockwave-flash", "tiff": "image/tiff", "txt": "text/plain",
        "wav": "audio/x-wav", "wma": "audio/x-ms-wma", "wmv": "video/x-ms-wmv",
        "xml": "text/xml", "mp3": "audio/mpeg", "mp4": "video/mp4"
    };

    // file Server =========================================//
    function chooseType(realPath) {
        var suffix = realPath.slice(realPath.lastIndexOf(".") + 1);
        if (typeof mimeSet[suffix] == "undefined") return mimeSet.unknown;
        else return mimeSet[suffix];
    }

    function parseRange(rangeStr, filesize) {
        // https://blog.csdn.net/thewindkee/article/details/80189434
        // Examples: 1.Range: bytes=1-499 (1-499 Bytes) 2.Range: bytes=-500 (last 500 Bytes)
        // 3. Range: bytes=500- (500-end Bytes) 4.Range: bytes=500-600,601-999
        // Res: Content-Range: bytes (unit first byte pos) - [last byte pos]/[entity length]
        // Examples: Content-Range: bytes 1-499/22400
        var results = []; var start = 0, end = 0;
        if (rangeStr.indexOf("=") == -1 || filesize <= 0) return results;
        rangeStr = rangeStr.slice(rangeStr.indexOf("=") + 1);
        var rangeList = rangeStr.split(",");
        for (var i in rangeList) {
            var rangeStr = rangeList[i].trim();
            if (rangeStr.indexOf("-") == -1) {
                return results; // not a correct rangeStr
            }
            var rangeArr = rangeStr.split("-");
            if (rangeArr[0] == "" && rangeArr[1] == "") {
                start = 0; end = filesize - 1;
            } else if (rangeArr[0] == "" && rangeArr[1] != "") {
                start = filesize - Number(rangeArr[1]); end = filesize - 1;
            } else if (rangeArr[0] != "" && rangeArr[1] == "") {
                start = Number(rangeArr[0]); end = filesize - 1;
            } else if (rangeArr[0] != "" && rangeArr[1] != "") {
                start = Number(rangeArr[0]); end = Number(rangeArr[1]);
            }
            results.push({ "start": start, "end": end });
        }
        return results;
    }

    function sendFile(octet, realPath, Request, Response) {
        var start = 0, end = 0;
        if (!fs.existsSync(realPath)) {
            if (octet) {
                Response.statusCode = 404;
                Response.end();
            }
            return "Error: path not Exist";
        }
        var stats = fs.statSync(realPath);
        if (stats.isDirectory()) {
            if (octet) {
                Response.statusCode = 404;
                Response.end();
            }
            return "Error: is Directory";
        }

        var fileName = realPath.slice(realPath.lastIndexOf("/") + 1);
        var fileSize = stats.size;
        var LastModified = stats.mtime.toUTCString();
        var Etag = 'W/"' + fileSize + '-' + stats.mtime.getTime() + '"';
        var contentType = chooseType(realPath);
        var contentDisposition = "filename=\"" + encodeURIComponent(fileName) + "\"; filename*=utf-8''" + encodeURIComponent(fileName);
        if (octet) contentDisposition = "attachment;" + contentDisposition;

        var modifiedSince = (Request.headers["if-modified-since"] == LastModified);
        var noneMatch = (Request.headers["if-none-match"] == Etag);
        if (modifiedSince || noneMatch) {
            Response.statusCode = 304;
            Response.end();
            return "";
        }

        Response.setHeader("Accpet-Ranges", "bytes");
        Response.setHeader("Cache-Control", "public, max-age=0");
        Response.setHeader("Last-Modified", LastModified);
        Response.setHeader("Etag", Etag);
        Response.setHeader("Content-Disposition", contentDisposition);
        if (contentType) Response.setHeader("Content-type", contentType);
        else Response.setHeader("Content-type", "application/octet-stream");

        if (!Request.headers["range"]) {
            start = 0; end = fileSize;
            Response.setHeader("Content-Length", fileSize);
            Response.statusCode = 200;
        } else {
            var ranges = parseRange(Request.headers["range"], fileSize);
            if (ranges.length == 0) { // has no range
                Response.statusCode = 416;
                Response.end();
                return "";
            }
            // only trans the first
            start = ranges[0]["start"]; end = ranges[0]["end"];
            Response.setHeader("Content-Length", String(end - start + 1));
            Response.setHeader("Content-Range",
                "bytes " + String(start) + "-" + String(end) + "/" + String(fileSize));
            Response.statusCode = 206;
        }
        fs.createReadStream(realPath, { "start": start, "end": end }).pipe(Response);
        return "";
    }

    function scanIndex(realPath) {
        if (realPath.slice(-1) == "/") realPath = realPath.slice(0, -1);
        var pageRank = -1; var webPage = ""; var name = "";
        try { var files = fs.readdirSync(realPath); } catch (err) { return webPage };
        if (files.length == 0) return webPage;
        for (var i in files) {
            name = files[i];
            var rank = indexList.indexOf(name);
            if (rank != -1 && (pageRank == -1 || rank < pageRank)) {
                pageRank = rank;
                webPage = "./" + encodeURIComponent(name);
            }
        }
        return webPage;
    }

    function sendMessage(statusCode, errInfo, Response) {
        Response.statusCode = statusCode;
        Response.setHeader('Content-Type', 'text/html; charset=utf-8');
        Response.end('<div style="padding:48px;">'
            + '<div style="font-weight:600;font-size:36px;word-break:break-word;">'
            + errInfo + '</div></div>');
    }

    function reDirect(statusCode, target, Response) {
        Response.setHeader("Location", target);
        Response.statusCode = statusCode;
        Response.end();
    }

    this.sendStatic = function (ignorePage, realPath, Request, Response) {
        var err = sendFile(false, realPath, Request, Response);
        if (err == "Error: is Directory") {
            if (ignorePage) {
                var err = sendFile(false, homePage, Request, Response);
                if (err != "") sendMessage(200, err, Response);
                return;
            }
            var webPage = scanIndex(realPath);
            if (webPage == "") {
                var err = sendFile(false, homePage, Request, Response);
                if (err != "") sendMessage(200, err, Response);
            } else {
                reDirect(302, webPage, Response);
            }
        } else if (err != "") {
            sendMessage(404, err, Response);
        }
    }

    this.sendFile = sendFile;
    this.reDirect = reDirect;
    this.sendMessage = sendMessage;
    // read Dir ===========================================//
    // dirInfo { FileList, FolderList, Err string }
    // dirList { Name, Time, Size string }

    this.readDirSync = function (realPath) {
        if (realPath.slice(-1) == "/") realPath = realPath.slice(0, -1);
        var info = {
            "FileList": "", "FolderList": "", "Err": ""
        };
        var fileList = [];
        var folderList = [];
        try {
            var files = fs.readdirSync(realPath);
            for (var i in files) {
                var name = files[i];
                try { var stats = fs.statSync(realPath + '/' + name); } catch (err) { continue; }
                var time = (Math.round(stats.mtime.getTime() / 1000)).toString();
                var size = stats.size.toString();
                var list = { "Name": encodeURIComponent(name), "Time": time, "Size": size };
                if (stats.isDirectory()) folderList.push(list);
                else fileList.push(list);
            }
            if (!files.length) {
                info.Err = "no file found";
                return JSON.stringify(info);
            }
            info.FileList = JSON.stringify(fileList);
            info.FolderList = JSON.stringify(folderList);
            return JSON.stringify(info);
        } catch (err) {
            info.Err = err.toString();
            return JSON.stringify(info);
        }
    }

    // postAction ===================================================================//
    var tokenList = [];

    function md5Crypto(str) {
        var md5 = crypro.createHash('md5');
        return md5.update(str).digest('hex');
    }

    function checkToken(token, isAuth) {
        var now = Math.round(new Date().getTime() / 1000);
        if (isAuth) {
            if (token != md5Crypto(authKey)) return authFail;
            var newKey = "time" + now.toString();
            var newToken = md5Crypto("token" + newKey + "end");
            tokenList[newKey] = newToken;
            return newToken;
        }
        for (var key in tokenList) {
            var time = parseInt(key.slice(4));
            // console.log(now + " " + time + " " + (now - time));
            if ((now - time) > sessionTime * 60) {
                delete tokenList[key];
            } else if (tokenList[key] == token){
                delete tokenList[key];
                var newKey = "time" + now.toString();
                tokenList[newKey] = token;
                return authPass;
            } 
        }
        return authFail;
    }

    this.checkToken = checkToken;

    this.postAuth = function (token) {
        return checkToken(token, true);
    }

    this.postClose = function (token) {
        if (checkToken(token, false) == authPass) {
            for (var oldToken in tokenList) {
                if (tokenList[oldToken] == token) {
                    delete tokenList[oldToken];
                    return token;
                }
            }
            return "";
        }
        return authFail;
    }

    this.postMkdir = function (token, realPath) {
        if (checkToken(token, false) == authPass) {
            if (fs.existsSync(realPath))
                return "exist";
            try {
                fs.mkdirSync(realPath, { recursive: true });
                return "pass";
            } catch (err) {
                return "fail";
            }
        }
        return authFail;
    }

    this.postRemove = function (token, realPath) {
        if (checkToken(token, false) == authPass) {
            var dirPath = realPath.slice(0, realPath.lastIndexOf("/"));
            var name = realPath.slice(realPath.lastIndexOf("/") + 1);
            var trashPath = dirPath + "/" + trashDir;
            var trashFile = trashPath + "/" + name;
            if (dirPath.indexOf(trashDir) != -1) return "exist";
            if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
            if (fs.existsSync(trashFile))
                trashFile += "_" + (Math.round(new Date().getTime() / 1000)).toString();
            try {
                fs.renameSync(realPath, trashFile);
                return "pass";
            } catch (err) {
                return "fail";
            }
        }
        return authFail;
    }

    this.postRename = function (token, oriPath, newPath) {
        if (checkToken(token, false) == authPass) {
            if (fs.existsSync(newPath))
                return "exist";
            try {
                fs.renameSync(oriPath, newPath);
                return "pass";
            } catch (err) {
                return "fail";
            }
        }
        return authFail;
    }

    // upload ========================================================//
    this.uploadCheck = function (token, realPath, fileMd5, chunksStr) {
        if (checkToken(token, false) == authPass) {
            var chunks = Number(chunksStr);
            var result = { "finished": [], "exist": [] };
            if (fs.existsSync(realPath))
                result["exist"].push("exist");
            for (var i = 0; i < chunks; i++) {
                var fileNum = String(i);
                var chunkPath = realPath + "_" + fileMd5 + "_" + fileNum + ".tmp";
                if (fs.existsSync(chunkPath)) result["finished"].push(fileNum);
            }
            return JSON.stringify(result);
        }
        return authFail;
    }

    this.uploadMerge = function (token, realPath, fileMd5, chunksStr) {
        if (checkToken(token, false) == authPass) {
            // var buf []byte;
            var chunks = Number(chunksStr);
            var outfile = fs.createWriteStream(realPath);
            for (var i = 0; i < chunks; i++) {
                var chunkPath = realPath + "_" + fileMd5 + "_" + String(i) + ".tmp";
                outfile.write(fs.readFileSync(chunkPath));
            }
            outfile.end();
            for (var i = 0; i < chunks; i++) {
                var chunkPath = realPath + "_" + fileMd5 + "_" + String(i) + ".tmp";
                fs.unlink(chunkPath, function (err) { }); // use async
            }
            return signPass;
        }
        return authFail;
    }

    this.uploadChunk = function (token, realPath, fileMd5, currentStr, content) {
        // content size should be limited 
        if (checkToken(token, false) == authPass) {
            var chunkPath = realPath + "_" + fileMd5 + "_" + currentStr + ".tmp";
            fs.writeFile(chunkPath, content, function (err) { }); // use async since sync version returns undefined 
            return signPass;
        }
        return authFail;
    }
}
