function uniqueStyle(styleText, useID) {
    // find uniqueID =================================
    var prefix = (typeof useID != "undefined" && useID) ? "#ID" : ".ID";
    var uniqueID = "";
    while (true) {
        uniqueID = prefix + Math.floor(new Date().getTime() * Math.random());
        if (document.querySelector(uniqueID) == null) break;
    }
    // sort style text ===============================
    // thinking @media{.a{}}
    if (styleText.indexOf("<style") != -1) {
        styleText = styleText.slice(styleText.indexOf("<style") + 6);
        styleText = styleText.slice(styleText.indexOf(">") + 1);
    }
    if (styleText.indexOf("</style>") != -1)
        styleText = styleText.slice(0, styleText.indexOf("</style>"));
    var styleGroups = styleText.split('@'), newStyleGroups = [];
    for (var g = 0; g < styleGroups.length; g++) {
        var styleText = styleGroups[g].trim();
        var headInfo = "";
        if (styleText == "") continue;
        // g!=0 means has @ before
        if (g != 0) {
            headInfo = "@" + styleText.slice(0, styleText.indexOf("{")).trim();
            styleText = styleText.slice(styleText.indexOf("{") + 1, styleText.lastIndexOf("}")).trim();
        }
        var oriStyles = styleText.split('}'), newStyles = [];
        for (var i = 0; i < oriStyles.length; i++) {
            var style = oriStyles[i].trim(), styleT = "";
            if (style == "") continue;
            style = style + "}";
            var selecters = style.slice(0, style.indexOf("{")).split(',');
            for (var j = 0; j < selecters.length; j++) {
                var selecter = selecters[j].trim();
                if (selecter != "") styleT += uniqueID + " " + selecter + ", ";
            }
            if (styleT != "") // slice(0, -2) to remove ", "
                newStyles.push(styleT.slice(0, -2) + style.slice(style.indexOf("{")));
        }
        if (headInfo == "") newStyleGroups.push(newStyles.join(" "));
        else newStyleGroups.push(headInfo + "{" + newStyles.join(" ") + "}");
    }

    // console.log(styles); console.log(newStyles);
    return { "uniqueID": uniqueID, "styleText": "<style>" + newStyleGroups.join(" ") + "</style>" };
}

function insertStyleHtml(styleText, htmlText, container) {
    var unique = uniqueStyle(styleText);
    container.innerHTML = unique.styleText + htmlText;
    container.className += " " + unique.uniqueID.slice(1);
}

function AdminCore() {
    // locals =====================================//
    var signAddr = "home.php?path=";
    var authTimeOut, reAuthTime = 5; // 5min
    var currentToken = "", currentAddr = "";
    var authFail = "authFail";
    var chunkSize = 2 << 20;// 2MB 
    var uploadConcurrent = 3; // max concurrent

    resetAddr(); // as init

    function md5File(file, progressCallBack, errCallBack) {
        if (typeof progressCallBack == "undefined") progressCallBack = function (cur, total, result) { };
        if (typeof errCallBack == "undefined") errCallBack = function (err) { };
        var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
        var chunkSize = 2 * 1024 * 1024;
        var chunks = Math.ceil(file.size / chunkSize);
        var currentChunk = 0;
        var spark = new SparkMD5.ArrayBuffer();
        var fileReader = new FileReader();
        fileReader.onerror = errCallBack;
        fileReader.onload = function (e) {
            currentChunk++;
            spark.append(e.target.result);
            var md5 = "";
            if (currentChunk < chunks) loadNext();
            else md5 = spark.end();
            progressCallBack(currentChunk, chunks, md5);
        };
        function loadNext() {
            var start = currentChunk * chunkSize;
            var end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
            fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
        }
        loadNext();
    }
    function getAction(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("Cache-Control", "no-cache"); // disable cache
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) callback(xhr.responseText);
        };
        xhr.send(null);
    }
    function postAction(url, callback, postData, addition) {
        if (typeof postData == "undefined") postData = null;
        if (typeof addition == "undefined") addition = function (xhr) { };
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Cache-Control", "no-cache"); // disable cache
        addition(xhr);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                if (xhr.responseText == authFail) currentToken = "";
                callback(xhr.responseText);
            }
        };
        xhr.send(postData);
        try { clearTimeout(authTimeOut); } catch (err) { }
        authTimeOut = setTimeout(function () {
            adminCore.closeSessionCore(url, function () { });
        }, reAuthTime * 60 * 1000);
    }
    function resetAddr(link) {
        if (typeof link == "undefined" || link.indexOf(signAddr) == -1) {
            link = window.location.href;
        }
        if (link.indexOf(signAddr) == -1) {
            currentAddr = "./" + signAddr;
            return currentAddr + encodeURIComponent("/");
        } else {
            currentAddr = link.slice(0, link.indexOf(signAddr) + signAddr.length);
            return link;
        }
    }
    function fomatPath(oriPath, currentAddr) {
        var oriPathList = decodeURIComponent(oriPath).split("/");
        var oriLength = oriPathList.length;
        var pathList = []; // pathList is urlDecoded
        for (var i = 0; i < oriLength; i++) {
            if (oriPathList[i].trim() == "..") pathList.pop();
            else if (oriPathList[i].trim() != "") pathList.push(oriPathList[i]);
        }
        var pathListLength = pathList.length;
        var pathLinkList = [currentAddr + encodeURIComponent("/")];
        for (var i = 0; i < pathListLength; i++) {
            var path = encodeURIComponent('/' + pathList.slice(0, i + 1).join("/"));
            pathLinkList.push(currentAddr + path);
        }
        return pathLinkList;
    }
    function uploadCheck(token, fileMd5, chunks, targetLink, callback) {
        var checkURL = targetLink + "&method=check" + "&token=" + token;
        checkURL += "&fileMd5=" + fileMd5 + "&chunks=" + chunks;
        postAction(checkURL, function (result) { callback(result, -1); }, null);
    }
    function uploadMerge(token, fileMd5, chunks, targetLink, callback) {
        var mergeURL = targetLink + "&method=merge&token=" + token;
        mergeURL += "&fileMd5=" + fileMd5 + "&chunks=" + chunks;
        postAction(mergeURL, function (result) { callback(result, -1); }, null);
    }
    function uploadChunk(token, fileMd5, currentChunk, file, targetLink, callback) {
        // callback(result, progress), -1 means finished
        var start = currentChunk * chunkSize;
        var end = start + chunkSize;
        if (end > file.size) end = file.size;
        var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
        var chunkData = blobSlice.call(file, start, end); // should not be an array
        var chunkUrl = targetLink + "&method=chunk" + "&token=" + token;
        chunkUrl += "&fileMd5=" + fileMd5 + "&current=" + currentChunk;
        var postData = new FormData();
        postData.append(currentChunk, chunkData);
        postAction(chunkUrl, function (result, err) { callback(result, currentChunk, 1); }, postData, function (xhr) {
            xhr.upload.onprogress = function (evt) { callback("on", currentChunk, evt.loaded / evt.total); };
        }
        );
    }

    // methods =============================================//
    this.getAuthStat = function () {
        return (currentToken != "");
    }
    this.getMonitor = function (callback) {
        getAction(currentAddr + "&method=monitor", function (result) {
            try { callback(JSON.parse(result)); }
            catch (err) {
                console.log(err);
                console.log("Error Get Info, Received:", result);
            }
        });
    }
    this.download = function (link) {
        window.open(link + "&method=getFile", "_self");
    }
    this.openFolder = function (link, callback) {
        if (link == "") link = resetAddr();
        if (link.indexOf(currentAddr) != 0) resetAddr(link);
        getAction(link + "&method=getDir", function (result) {
            try {
                var info = JSON.parse(result);
                if (info.Err != "") console.log(info.Err, ":", link);
                // var pathList = fomatPath(info.CurrentURLPath, currentAddr);
                var pathList = fomatPath(link.slice(currentAddr.length), currentAddr);
                var fileList = [], folderList = [];
                try {
                    fileList = JSON.parse(info.FileList);
                    folderList = JSON.parse(info.FolderList);
                } catch (err) { }
                if (!fileList) fileList = [];
                if (!folderList) folderList = [];
                callback({
                    "pathList": pathList, "fileList": fileList, "folderList": folderList
                });
            } catch (err) {
                console.log(err);
                console.log("Error Get Info, Received:", result);
            }
        });
    }
    this.askAuthCore = function (key, targetLink, passCallBack, failCallBack) {
        // targetLink can be any valid link
        var authKey = SparkMD5.hash(key);
        postAction(targetLink + "&method=auth&token=" + authKey, function (result) {
            if (result.indexOf(authFail) == -1) {
                currentToken = result;
                passCallBack();
            } else {
                currentToken = "";
                failCallBack(result);
            }
        });
    }
    this.closeSessionCore = function (targetLink, callback) {
        // targetLink can be any valid link
        postAction(targetLink + "&method=close&token=" + currentToken, callback);
        currentToken = "";
    }
    this.mkdirCore = function (targetLink, callback) {
        postAction(targetLink + "&method=mkdir&token=" + currentToken, callback);
    }
    this.removeCore = function (targetLink, callback) {
        postAction(targetLink + "&method=remove&token=" + currentToken, callback);
    }
    this.renameCore = function (targetLink, newLink, callback) {
        postAction(targetLink + "&method=rename&token=" + currentToken + "&newLink=" + encodeURIComponent(newLink), callback);
    }
    this.uploadFile = function (file, dirLink, callback) {
        // callback(progress, sign)
        // sign: md5, upload, authFail, exist, fail, chunked, finish
        var token = currentToken, maxConcurrent = uploadConcurrent, merged = false;
        var chunks = Math.ceil(file.size / chunkSize);
        var targetLink = dirLink + encodeURIComponent("/" + file.name);
        var chunkStats = []; // -1: not uploaded, 1: upload finished; 0-1: on upload;

        function uploadPieces(token, fileMd5, file, targetLink, callback) {
            var current = -1;
            for (var i = 0; i < chunkStats.length; i++) {
                if (chunkStats[i] == -1) { current = i; break; }
            }
            if (current == -1) return;
            chunkStats[current] = 0;
            uploadChunk(token, fileMd5, current, file, targetLink, function (result, current, progress) {
                chunkStats[current] = progress;
                callback(result);
                if (result.indexOf("pass") != -1) {
                    uploadPieces(token, fileMd5, file, targetLink, callback);
                }
            });
        }

        md5File(file, function (currentMd5Chunk, md5Chunks, fileMd5) {
            callback(currentMd5Chunk / md5Chunks, "md5");
            if (currentMd5Chunk < md5Chunks) return;
            // start upload
            uploadCheck(token, fileMd5, chunks, targetLink, function (result) {
                // if authFail
                if (result.indexOf("authFail") != -1) {
                    callback(0, "authFail");
                    return;
                }
                // else if exist already
                result = JSON.parse(result);
                if (result.exist.length) {
                    callback(1, "exist");
                    return;
                }
                // else upload
                var progress = 0;
                var finished = result.finished; // ["0","1","2",...]
                for (var j = 0; j < chunks; j++) {
                    if (finished.indexOf(j.toString()) == -1) chunkStats.push(-1);
                    else { chunkStats.push(1); progress += 1; }
                }
                progress = progress / chunkStats.length;
                callback(progress, "upload");
                // upload concurrently
                for (var i = 0; i < maxConcurrent; i++) {
                    uploadPieces(token, fileMd5, file, targetLink, function (result) {
                        var progress = 0;
                        for (var j = 0; j < chunkStats.length; j++) {
                            if (chunkStats[j] != -1) progress += chunkStats[j];
                        }
                        progress = progress / chunkStats.length;
                        callback(progress, "upload");
                        if (result.indexOf("authFail") != -1) callback(progress, "authFail");
                        else if (result.indexOf("fail") != -1) callback(progress, "fail");
                        else callback(progress, "upload");

                        if (progress == 1 && merged == false) {
                            merged = true;
                            uploadMerge(token, fileMd5, chunks, targetLink, function (result) {
                                if (result.indexOf("authFail") != -1) callback(1, "authFail");
                                else if (result.indexOf("fail") != -1) callback(1, "fail");
                                else if (result.indexOf("chunked") != -1) callback(1, "chunked");
                                else callback(1, "finish");
                            });
                        }
                    });
                }
            });
        });
    }
}

function FileIndex(indexBox, opts) {
    // parameters ============================================//
    if (typeof indexBox == "string") indexBox = document.querySelector(indexBox);
    if (typeof opts == "undefined") opts = {};
    var windowPush = ("windowPush" in opts) ? opts.windowPush : true;
    var enViewer = ("enViewer" in opts) ? opts.enViewer : true;
    var basicSize = ("basicSize" in opts) ? opts.basicSize : "14px";
    var topTitle = ("topTitle" in opts) ? opts.topTitle : "MikoSite"
    var tableHeadColor = ("tableHeadColor" in opts) ? opts.tableHeadColor : "rgba(255,255,255,0.2)";
    var tableItemColor = ("tableItemColor" in opts) ? opts.tableItemColor : "rgba(255,255,255,0.5)";
    var tableItemHover = ("tableItemHover" in opts) ? opts.tableItemHover : "rgba(196,196,196,0.75)";
    var tableItemChose = ("tableItemChose" in opts) ? opts.tableItemChose : "rgba(255,255,200,0.75)";
    var updateListCallBack = ("updateListCallBack" in opts) ? opts.updateListCallBack : function () { };

    // html and style ===========================================// 
    {
        var fileIndexStyle = '\
            .pathLine {position:absolute;top:0;right:0;left:0;padding:0.5em;background:#fefefe;box-shadow: 6px 0px 6px #ddd;}\
            .pathHead {padding: 0 0.5em;float:left;cursor:pointer;color:#ead;font-weight:600;font-size:1.6em;}\
            .pathMenu {float:right;color:#dc6;font-weight:900;font-size:1.6em;}\
            .pathChain {overflow:auto;white-space: nowrap;color:#222;font-size:1em;padding:0.6em 0 0 0;}\
            .pathChain a {cursor:pointer;}\
            .pathMenu a {cursor:pointer; margin:0 0.5em;}\
            .listTable {position:absolute;top:3em;right:0;bottom:0;left:0;overflow:auto;padding:1em;border-radius:0.3em;}\
            .listTable .head, .listTable .item {overflow:hidden;display:block;}   \
            .listTable .head { background:'+ tableHeadColor + ';                         \
                border-bottom: 3px solid rgba(64, 64, 64, 1); }                                 \
            .listTable .item { display:block; background:'+ tableItemColor + ';         \
                border-top: 1px solid rgba(0, 0, 0, 0.125); }                      \
            .listTable .item:hover { background:'+ tableItemHover + '; }                 \
            .colicon { float: left; height: 2.4em; width: 2.4em;         \
                margin:0.2em 0; background-repeat: no-repeat; background-size: contain; }       \
            .coltext { overflow: hidden;                                 \
                text-align: left; font-size: 1em; color: #233; font-weight: 600; }              \
            .colname { width: 50%; } .coltime { width: 24%; }                          \
            .colsize { width: 20%; }                    \
            .colname, .coltime, .colsize { float: left; cursor: pointer;  \
                display:block; overflow: auto; padding: 0.7em 1%; word-break: break-all; }    ';

        var fileIndexHtml = '\
            <div style="position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;font-size:' + basicSize + ';"> \
            <div class="listTable">                          \
            <a class="head"><div class="colicon"></div><div class="coltext">                    \
            <div class="colname" style="cursor:pointer;font-size:1.2em;">Name</div>             \
            <div class="coltime" style="cursor:pointer;font-size:1.2em;">Last Modified</div>    \
            <div class="colsize" style="cursor:pointer;font-size:1.2em;">Size</div></div></a>   \
            <a class="item parent"><div class="colicon iconHome"></div><div class="coltext">    \
            <div class="colname">Parent Directory</div><div class="coltime">-</div>             \
            <div class="colsize">-</div></div></a><div class="list" style="width:100%">         \
            <div class="folder"></div><div class="file"></div></div>                            \
            <div style="height:4em;"></div></div>\
            <div class="pathLine">\
            <div class="pathMenu"><a class="admin">+</a></div>\
            <div class="pathHead">'+ topTitle + '</div><div class="pathChain"></div>\
            </div>\
            </div>\
            <div class="viewBox"></div>';
    }
    insertStyleHtml(fileIndexStyle, fileIndexHtml, indexBox);

    // locals =====================================================//
    var currentLink = "";
    var fileList = [], folderList = [];
    var procFileList = [], procFolderList = [];
    var nameOrder = false, timeOrder = false, sizeOrder = false; // false means sort small -> big
    var iconType = {
        // "iconHome" // "iconFolder" // "iconUnknown"
        "iconPdf": [".pdf"],
        "iconPy": [".py"],
        "iconMd": [".md", ".MD"],
        "iconJs": [".js", ".json"],
        "iconIso": [".iso", ".img"],
        "iconPhp": [".php", ".phtml"],
        "iconBin": [".bin", ".hex", ".dll"],
        "iconC": [".h", ".c", ".hpp", ".cpp"],
        "iconJava": [".class", ".jar", ".java"],
        "iconCss": [".css", ".sass", ".scss", ".less"],
        "iconHtml": [".html", ".xhtml", ".shtml", ".htm", ".url"],
        "iconCode": [".xml", ".bat", ".BAT", ".cmd", ".sh", ".ps", ".m", ".go"],
        "iconTar": [
            ".zip", ".7z", ".bz2", ".cab", ".gz", ".xz", ".tar", ".rar"
        ],
        "iconPre": [
            ".ppt", ".pptx", ".pot", ".potx", ".pptm", ".potm", ".xps"
        ],
        "iconSheet": [
            ".xlsx", ".xlsm", ".xltx", ".xltm", ".xlam", ".xlr", ".xls", ".csv"
        ],
        "iconFont": [
            ".ttf", ".TTF", ".woff", ".WOFF", ".woff2", ".WOFF2", ".otf", ".OTF"
        ],
        "iconText": [
            ".txt", ".cnf", ".conf", ".map", ".yaml", ".ini", ".nfo", ".info", ".log"
        ],
        "iconPkg": [
            ".pkg", ".dmg", ".rpm", ".deb", ".pak", ".apk", ".exe", ".EXE", ".msi", ".MSI"
        ],
        "iconDoc": [
            ".doc", ".docx", ".docm", ".dot.", "dotx", ".dotm",
            ".log", ".msg", ".odt", ".pages", ".rtf", ".tex", ".wpd", ".wps"
        ],
        "iconImg": [
            ".bmp", ".png", ".tiff", ".tif", ".gif", ".jpg", ".jpeg",
            ".jpe", ".psd", ".ai", ".ico", ".webp", ".svg", ".svgz", ".jfif",
        ],
        "iconAudio": [
            ".aac", ".aif", ".aifc", ".aiff", ".ape", ".au", ".flac", ".iff",
            ".m4a", ".mid", ".mp3", ".mpa", ".ra", ".wav", ".wma", ".f4a", ".f4b",
            ".oga", ".ogg", ".xm", ".it", ".s3m", ".mod"
        ],
        "iconVideo": [
            ".asf", ".asx", ".avi", ".flv", ".mkv", ".mov", ".mp4", ".mpg",
            ".rm", ".srt", ".swf", ".vob", ".wmv", ".m4v", ".f4v", ".f4p", ".ogv", ".webm"
        ]
    }

    var viewBox = indexBox.querySelector('.viewBox');
    var pathLine = indexBox.querySelector(".pathLine");
    var listTable = indexBox.querySelector(".listTable");
    var pathHead = pathLine.querySelector(".pathHead");
    var pathChain = pathLine.querySelector(".pathChain");
    var pathMenu = pathLine.querySelector(".pathMenu");
    var listHead = listTable.querySelector(".head");
    var listPDir = listTable.querySelector(".parent");
    var listFolder = listTable.querySelector(".folder");
    var listFile = listTable.querySelector(".file");

    var adminCore = new AdminCore();
    var viewer = (enViewer) ? new FileViewer(viewBox, { "refresh": refresh, "chooseIcon": chooseIcon, "adminCore": adminCore }) : null;

    listHead.querySelector('.colname').onclick = function () { sortItem("name"); };
    listHead.querySelector('.coltime').onclick = function () { sortItem("time"); };
    listHead.querySelector('.colsize').onclick = function () { sortItem("size"); };
    pathHead.onclick = function () {
        if (listTable.scrollTop != 0) {
            listTable.scrollTop = 0;
            return;
        }
        if (pathChain.getAttribute("contenteditable") == "true") {
            pathChain.setAttribute("contenteditable", "false");
            openFolder(false, pathChain.getAttribute('addr') + encodeURIComponent(pathChain.innerText));
        } else {
            var path = currentLink.slice(pathChain.getAttribute('addr').length);
            pathChain.innerHTML = '<a>' + decodeURIComponent(path) + '</a>';
            pathChain.setAttribute("contenteditable", "true");
        }
    }
    pathChain.onkeypress = function () {
        if (event.keyCode == "13") {
            pathChain.setAttribute("contenteditable", "false");
            openFolder(false, pathChain.getAttribute('addr') + encodeURIComponent(pathChain.innerText));
        }
    }
    pathMenu.querySelector('.admin').onclick = function () {
        if (typeof viewer != "undefined")
            viewer.openMenu(currentLink, procFileList.concat(procFolderList));
    }

    if (windowPush)
        window.addEventListener('popstate', function (evt) { // state:{title,url} 
            try { openFolder(true, evt.state.url); } catch (err) { }
        });

    function formatSize(sizeB) {
        // Cautions: >> is limited to 32bit signed int, 1<<31 
        // version 1 ==========================================//
        var GB = 1 << 30, MB = 1 << 20, KB = 1 << 10;
        if (sizeB > GB) return (sizeB / GB).toFixed(3) + "G";
        else if (sizeB > MB) return (sizeB / MB).toFixed(3) + "M";
        else if (sizeB > KB) return (sizeB / KB).toFixed(3) + "K";
        else return sizeB.toString() + "B";
        // version 2 =========================================//
        var GB = 1 << 30, sizeG = 0;
        if (sizeB > GB) {
            sizeG = Math.floor(sizeB / GB);
            sizeB -= sizeG * GB;
        }
        var sizeK = sizeB >> 10;
        var sizeM = sizeK >> 10;
        sizeB -= sizeK << 10;
        sizeK -= sizeM << 10;
        if (sizeG) return sizeG + 'G ' + sizeM + 'M ' + sizeK + 'K ' + sizeB + 'B ';
        else if (sizeM) return sizeM + 'M ' + sizeK + 'K ' + sizeB + 'B ';
        else if (sizeK) return sizeK + 'K ' + sizeB + 'B ';
        else return sizeB + 'B ';

    }
    function chooseIcon(name) {
        if (name == "IconFolder") return "iconFolder";
        var suffix = name.slice(name.lastIndexOf("."));
        for (var icon in iconType) {
            if (iconType[icon].indexOf(suffix) != -1)
                return icon;
        }
        return "iconUnknown";
    }
    function updateItems(currentLink, fileList, folderList) {
        // ensure currentLink is like ..../..?%2F%......
        var fileListLength = fileList.length;
        var folderListLength = folderList.length;
        // update listFolder
        var htmlFolder = [];
        for (var i = 0; i < folderListLength; i++) {
            var thisInfo = folderList[i];
            var name = decodeURIComponent(thisInfo.Name);
            var time = new Date(Number(thisInfo.Time + "000")).toISOString();
            var link = currentLink + "%2F" + thisInfo.Name;
            htmlFolder.push(
                '<div class="item" link="' + link + '">'
                + '<div class="colicon ' + chooseIcon('IconFolder') + '"></div>'
                + '<div class="coltext"><div class="colname">' + name + '</div>'
                + '<div class="coltime">' + time + '</div>'
                + '<div class="colsize"> - </div></div></div>'
            );
        }
        // update listFile
        var htmlFile = [], linkList = [];
        for (var i = 0; i < fileListLength; i++) {
            var thisInfo = fileList[i];
            var name = decodeURIComponent(thisInfo.Name);
            var time = new Date(Number(thisInfo.Time + "000")).toISOString();
            var link = currentLink + "%2F" + thisInfo.Name;
            linkList.push(link);
            htmlFile.push(
                '<div class="item" link="' + link + '">'
                + '<div class="colicon ' + chooseIcon(name) + '" ></div>'
                + '<div class="coltext"><div class="colname">' + name + '</div>'
                + '<div class="coltime">' + time + '</div>'
                + '<div class="colsize">' + formatSize(Number(thisInfo.Size)) + '</div></div></div>'
            );
        }
        // apply updates
        listFolder.innerHTML = htmlFolder.join("");
        listFile.innerHTML = htmlFile.join("");
        // update linkList
        if (typeof viewer != "undefined") viewer.setLinkList(linkList);
        updateListCallBack(linkList);
        // append onclick
        setTimeout(function () {
            // append listFolder
            var items = listFolder.children;
            var numItem = items.length;
            for (var i = 0; i < numItem; i++) {
                items[i].querySelector(".colname").onclick = function () { return linkAction(this.parentNode.parentNode.getAttribute('link'), true); };
                items[i].querySelector(".colsize").onclick = function () { return menuAction(this.parentNode.parentNode.getAttribute('link'), this.parentNode.parentNode, true); };
            }
            // append listFile
            var items = listFile.children;
            var numItem = items.length;
            for (var i = 0; i < numItem; i++) {
                items[i].querySelector(".colname").onclick = function () { return linkAction(this.parentNode.parentNode.getAttribute('link'), false); };
                items[i].querySelector(".colsize").onclick = function () { return menuAction(this.parentNode.parentNode.getAttribute('link'), this.parentNode.parentNode, false); };
                items[i].querySelector(".coltime").onclick = function () {
                    return downFile(this.parentNode.parentNode.getAttribute('link'));
                }
            }
        }, 32); // timeOut to process after (but not exact time to process)
    }
    function sortItem(item) {
        var sortf = function () { };
        switch (item) {
            case "name":
                if (nameOrder) sortf = function (b, a) { return a.Name.localeCompare(b.Name) };
                else sortf = function (a, b) { return a.Name.localeCompare(b.Name) };
                nameOrder = !nameOrder;
                break;
            case "time":
                if (timeOrder) sortf = function (b, a) { return a.Time - b.Time };
                else sortf = function (a, b) { return a.Time - b.Time };
                timeOrder = !timeOrder;
                break;
            case "size":
                if (sizeOrder) sortf = function (b, a) { return a.Size - b.Size };
                else sortf = function (a, b) { return a.Size - b.Size };
                sizeOrder = !sizeOrder;
                break;
            default:
                return;
        }
        fileList.sort(sortf);
        folderList.sort(sortf);
        updateItems(currentLink, fileList, folderList);
    }
    function updatePaths(pathList) {
        // pathList is like [link0 = encode(...path=/), link1 = ..., ...];
        var pathListLength = pathList.length;
        // update pathChain
        var pathChainLink = '<a class="path" link="' + pathList[0] + '"> Home </a>';
        for (var i = 1; i < pathListLength; i++) {
            var name = decodeURIComponent(pathList[i]);
            name = name.slice(name.lastIndexOf("/") + 1);
            pathChainLink += '<a class="path" link="' + pathList[i] + '"> > ' + name + '</a>\n';
        }
        pathChain.innerHTML = pathChainLink;
        pathChain.setAttribute('addr', pathList[0].slice(0, -1 * encodeURIComponent("/").length));
        // append pathChain
        var items = pathChain.querySelectorAll('.path');
        var numItem = items.length;
        for (var i = 0; i < numItem; i++) {
            items[i].onclick = function () { return linkAction(this.getAttribute('link'), true); };
        }
        // append listPDir
        listPDir.setAttribute("link", pathList[pathListLength - 2]);
        listPDir.onclick = function () { return linkAction(this.getAttribute('link'), true); };
    }
    function updateInfo(historyMode, info) {
        procFileList = [], procFolderList = [];
        fileList = info.fileList;
        folderList = info.folderList;
        fileList.sort(function (a, b) { return a.Name.localeCompare(b.Name) });
        folderList.sort(function (a, b) { return a.Name.localeCompare(b.Name) });
        currentLink = info.pathList[info.pathList.length - 1];
        if (!historyMode && windowPush) // not activated by window.onpopState
            window.history.pushState({ "title": null, "url": currentLink }, null, currentLink);
        updatePaths(info.pathList);
        updateItems(currentLink, fileList, folderList);
    }
    function downFile(link) {
        adminCore.download(link);
        return false;
    }
    function openFile(link) {
        if (typeof viewer != "undefined")
            viewer.openFile(link, chooseIcon(link));
    }
    function openFolder(historyMode, link) {
        // info : {pathList, fileList, folderList}
        adminCore.openFolder(link, function (info) { updateInfo(historyMode, info); });
    }
    function linkAction(link, isFolder) {
        if (isFolder) openFolder(false, link); else openFile(link);
        return false;
    }
    function menuAction(link, signEle, isFolder) {
        var procList = (isFolder) ? procFolderList : procFileList;
        var linkPos = procList.indexOf(link);
        if (linkPos == -1) {
            signEle.style.background = tableItemChose;
            procList.push(link);
        } else {
            signEle.style.background = "";
            procList.splice(linkPos, 1);
        }
        if (isFolder) procFolderList = procList;
        else procFileList = procList;
        // console.log(procFileList, procFolderList);
        return false;
    }
    function refresh() {
        openFolder(false, currentLink);
    }

    // methods =========================================================//
    this.chooseIcon = chooseIcon;
    this.refresh = refresh;
    this.setCore = function (coreInstance) { adminCore = coreInstance };
    this.setViewer = function (viewerInstance) { viewer = viewerInstance };
    this.setUpdateListCallBack = function (callback) { updateListCallBack = callback; }
    this.setLinkAction = function (enFolder, enFile, fn) {
        if (typeof fn != "function") fn = function (link, isFolder) { };
        var defFnFolder = (enFolder) ? openFolder : function (historyMode, link) { };
        var defFnFile = (enFile) ? openFile : function (link) { };
        linkAction = function (link, isFolder) {
            if (isFolder) defFnFolder(false, link);
            else defFnFile(link);
            fn(link, isFolder);
            return false;
        }
    }
}

