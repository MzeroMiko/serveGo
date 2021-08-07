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
    { // iconType, iconStyle, modified from vs-seti-theme.json
        var iconType = {
            "fileExtensions": {
                "bsl": "_bsl",
                "mdo": "_mdo",
                "asm": "_asm",
                "s": "_asm",
                "h": "_c_1",
                "aspx": "_html",
                "ascx": "_html_1",
                "asax": "_html_2",
                "master": "_html_2",
                "hh": "_cpp_1",
                "hpp": "_cpp_1",
                "hxx": "_cpp_1",
                "edn": "_clojure_1",
                "cfc": "_coldfusion",
                "cfm": "_coldfusion",
                "litcoffee": "_coffee",
                "config": "_config",
                "cfg": "_config",
                "conf": "_config",
                "cr": "_crystal",
                "ecr": "_crystal_embedded",
                "slang": "_crystal_embedded",
                "cson": "_json",
                "css.map": "_css",
                "sss": "_css",
                "csv": "_csv",
                "xls": "_xls",
                "xlsx": "_xls",
                "cake": "_cake",
                "ctp": "_cake_php",
                "d": "_d",
                "doc": "_word",
                "docx": "_word",
                "ejs": "_ejs",
                "ex": "_elixir",
                "exs": "_elixir_script",
                "elm": "_elm",
                "ico": "_favicon",
                "gitignore": "_git",
                "gitconfig": "_git",
                "gitkeep": "_git",
                "gitattributes": "_git",
                "gitmodules": "_git",
                "slide": "_go",
                "article": "_go",
                "gradle": "_gradle",
                "gsp": "_grails",
                "gql": "_graphql",
                "graphql": "_graphql",
                "haml": "_haml",
                "hs": "_haskell",
                "lhs": "_haskell",
                "hx": "_haxe",
                "hxs": "_haxe_1",
                "hxp": "_haxe_2",
                "hxml": "_haxe_3",
                "class": "_java",
                "classpath": "_java",
                "properties": "_java",
                "js.map": "_javascript",
                "spec.js": "_javascript_1",
                "test.js": "_javascript_1",
                "es": "_javascript",
                "es5": "_javascript",
                "es7": "_javascript",
                "jinja": "_jinja",
                "jinja2": "_jinja",
                "jl": "_julia",
                "kt": "_kotlin",
                "kts": "_kotlin",
                "dart": "_dart",
                "liquid": "_liquid",
                "ls": "_livescript",
                "argdown": "_argdown",
                "ad": "_argdown",
                "mustache": "_mustache",
                "stache": "_mustache",
                "njk": "_nunjucks",
                "nunjucks": "_nunjucks",
                "nunjs": "_nunjucks",
                "nunj": "_nunjucks",
                "njs": "_nunjucks",
                "nj": "_nunjucks",
                "npm-debug.log": "_npm",
                "npmignore": "_npm_1",
                "npmrc": "_npm_1",
                "ml": "_ocaml",
                "mli": "_ocaml",
                "cmx": "_ocaml",
                "cmxa": "_ocaml",
                "odata": "_odata",
                "php.inc": "_php",
                "pddl": "_pddl",
                "plan": "_plan",
                "happenings": "_happenings",
                "pug": "_pug",
                "pp": "_puppet",
                "epp": "_puppet",
                "spec.jsx": "_react_1",
                "test.jsx": "_react_1",
                "cjsx": "_react",
                "spec.tsx": "_react_2",
                "test.tsx": "_react_2",
                "re": "_reasonml",
                "r": "_R",
                "rmd": "_R",
                "erb": "_html_erb",
                "erb.html": "_html_erb",
                "html.erb": "_html_erb",
                "sass": "_sass",
                "springbeans": "_spring",
                "slim": "_slim",
                "smarty.tpl": "_smarty",
                "sbt": "_sbt",
                "scala": "_scala",
                "sol": "_ethereum",
                "styl": "_stylus",
                "tf": "_terraform",
                "tf.json": "_terraform",
                "tfvars": "_terraform",
                "tex": "_tex",
                "sty": "_tex_1",
                "dtx": "_tex_2",
                "ins": "_tex_3",
                "toml": "_config",
                "twig": "_twig",
                "spec.ts": "_typescript_1",
                "test.ts": "_typescript_1",
                "vala": "_vala",
                "vapi": "_vala",
                "vue": "_vue",
                "wasm": "_wasm",
                "wat": "_wat",
                "pro": "_prolog",
                "jar": "_zip",
                "zip": "_zip_1",
                "wgt": "_wgt",
                "ai": "_illustrator",
                "psd": "_photoshop",
                "pdf": "_pdf",
                "eot": "_font",
                "ttf": "_font",
                "woff": "_font",
                "woff2": "_font",
                "gif": "_image",
                "jpg": "_image",
                "jpeg": "_image",
                "png": "_image",
                "pxm": "_image",
                "svg": "_svg",
                "svgx": "_image",
                "sublime-project": "_sublime",
                "sublime-workspace": "_sublime",
                "component": "_salesforce",
                "cls": "_salesforce",
                "fish": "_shell",
                "mov": "_video",
                "ogv": "_video",
                "webm": "_video",
                "avi": "_video",
                "mpg": "_video",
                "mp4": "_video",
                "mp3": "_audio",
                "ogg": "_audio",
                "wav": "_audio",
                "flac": "_audio",
                "3ds": "_svg_1",
                "3dm": "_svg_1",
                "stl": "_svg_1",
                "obj": "_svg_1",
                "dae": "_svg_1",
                "babelrc": "_babel",
                "babelrc.js": "_babel",
                "babelrc.cjs": "_babel",
                "bowerrc": "_bower",
                "dockerignore": "_docker_1",
                "codeclimate.yml": "_code-climate",
                "eslintrc": "_eslint",
                "eslintrc.js": "_eslint",
                "eslintrc.yaml": "_eslint",
                "eslintrc.yml": "_eslint",
                "eslintrc.json": "_eslint",
                "eslintignore": "_eslint_1",
                "firebaserc": "_firebase",
                "jshintrc": "_javascript_2",
                "jscsrc": "_javascript_2",
                "stylelintrc": "_stylelint",
                "stylelintrc.json": "_stylelint",
                "stylelintrc.yaml": "_stylelint",
                "stylelintrc.yml": "_stylelint",
                "stylelintrc.js": "_stylelint",
                "stylelintignore": "_stylelint_1",
                "direnv": "_config",
                "env": "_config",
                "static": "_config",
                "editorconfig": "_config",
                "slugignore": "_config",
                "tmp": "_clock_1",
                "htaccess": "_config",
                "key": "_lock",
                "cert": "_lock",
                "ds_store": "_ignored"
            },
            "fileNames": {
                "mix": "_hex",
                "karma.conf.js": "_karma",
                "karma.conf.coffee": "_karma",
                "readme.md": "_info",
                "changelog.md": "_clock",
                "changelog": "_clock",
                "changes.md": "_clock",
                "version.md": "_clock",
                "version": "_clock",
                "mvnw": "_maven",
                "swagger.json": "_json_1",
                "swagger.yml": "_json_1",
                "swagger.yaml": "_json_1",
                "mime.types": "_config",
                "jenkinsfile": "_jenkins",
                "babel.config.js": "_babel",
                "babel.config.json": "_babel",
                "babel.config.cjs": "_babel",
                "bower.json": "_bower",
                "docker-healthcheck": "_docker_2",
                "docker-compose.yml": "_docker_3",
                "docker-compose.yaml": "_docker_3",
                "docker-compose.override.yml": "_docker_3",
                "docker-compose.override.yaml": "_docker_3",
                "firebase.json": "_firebase",
                "geckodriver": "_firefox",
                "gruntfile.js": "_grunt",
                "gruntfile.babel.js": "_grunt",
                "gruntfile.coffee": "_grunt",
                "gulpfile": "_gulp",
                "gulpfile.js": "_gulp",
                "ionic.config.json": "_ionic",
                "ionic.project": "_ionic",
                "platformio.ini": "_platformio",
                "rollup.config.js": "_rollup",
                "sass-lint.yml": "_sass",
                "stylelint.config.js": "_stylelint",
                "yarn.clean": "_yarn",
                "yarn.lock": "_yarn",
                "webpack.config.js": "_webpack",
                "webpack.config.build.js": "_webpack",
                "webpack.common.js": "_webpack",
                "webpack.dev.js": "_webpack",
                "webpack.prod.js": "_webpack",
                "license": "_license",
                "licence": "_license",
                "copying": "_license",
                "compiling": "_license_1",
                "contributing": "_license_2",
                "qmakefile": "_makefile_1",
                "omakefile": "_makefile_2",
                "cmakelists.txt": "_makefile_3",
                "procfile": "_heroku",
                "todo": "_todo",
                "npm-debug.log": "_npm_ignored"
            },
            "languageIds": {
                "bat": "_windows",
                "clojure": "_clojure",
                "coffeescript": "_coffee",
                "jsonc": "_json",
                "c": "_c",
                "cpp": "_cpp",
                "csharp": "_c-sharp",
                "css": "_css",
                "dockerfile": "_docker",
                "fsharp": "_f-sharp",
                "go": "_go2",
                "groovy": "_grails",
                "handlebars": "_mustache",
                "html": "_html_3",
                "java": "_java",
                "javascriptreact": "_react",
                "javascript": "_javascript",
                "json": "_json",
                "less": "_less",
                "lua": "_lua",
                "makefile": "_makefile",
                "markdown": "_markdown",
                "objective-c": "_c_2",
                "objective-cpp": "_cpp_2",
                "perl": "_perl",
                "php": "_php",
                "powershell": "_powershell",
                "jade": "_jade",
                "python": "_python",
                "r": "_R",
                "razor": "_html",
                "ruby": "_ruby",
                "rust": "_rust",
                "scss": "_sass",
                "search-result": "_code-search",
                "shellscript": "_shell",
                "sql": "_db",
                "swift": "_swift",
                "typescript": "_typescript",
                "typescriptreact": "_typescript",
                "xml": "_xml",
                "yaml": "_yml",
                "argdown": "_argdown",
                "elm": "_elm",
                "ocaml": "_ocaml",
                "nunjucks": "_nunjucks",
                "mustache": "_mustache",
                "erb": "_html_erb",
                "terraform": "_terraform",
                "vue": "_vue",
                "sass": "_sass",
                "kotlin": "_kotlin",
                "jinja": "_jinja",
                "haxe": "_haxe",
                "haskell": "_haskell",
                "gradle": "_gradle",
                "elixir": "_elixir",
                "haml": "_haml",
                "stylus": "_stylus",
                "vala": "_vala",
                "todo": "_todo",
                "postcss": "_css",
                "django-html": "_html_3"
            },
        }

        var iconStyle = '._folder:before {content:"\\E02F";color:#519aba;}._R:before{content:"\\E001";color:#519aba;}._argdown:before{content:"\\E003";color:#519aba;}._asm:before{content:"\\E004";color:#cc3e44;}._audio:before{content:"\\E005";color:#a074c4;}._babel:before{content:"\\E006";color:#cbcb41;}._bower:before{content:"\\E007";color:#e37933;}._bsl:before{content:"\\E008";color:#cc3e44;}._c:before{content:"\\E00A";color:#519aba;}._c-sharp:before{content:"\\E009";color:#519aba;}._c_1:before{content:"\\E00A";color:#a074c4;}._c_2:before{content:"\\E00A";color:#cbcb41;}._cake:before{content:"\\E00B";color:#cc3e44;}._cake_php:before{content:"\\E00C";color:#cc3e44;}._clock:before{content:"\\E010";color:#519aba;}._clock_1:before{content:"\\E010";color:#6d8086;}._clojure:before{content:"\\E011";color:#8dc149;}._clojure_1:before{content:"\\E011";color:#519aba;}._code-climate:before{content:"\\E012";color:#8dc149;}._code-search:before{content:"\\E013";color:#a074c4;}._coffee:before{content:"\\E014";color:#cbcb41;}._coldfusion:before{content:"\\E016";color:#519aba;}._config:before{content:"\\E017";color:#6d8086;}._cpp:before{content:"\\E018";color:#519aba;}._cpp_1:before{content:"\\E018";color:#a074c4;}._cpp_2:before{content:"\\E018";color:#cbcb41;}._crystal:before{content:"\\E019";color:#d4d7d6;}._crystal_embedded:before{content:"\\E01A";color:#d4d7d6;}._css:before{content:"\\E01B";color:#519aba;}._csv:before{content:"\\E01C";color:#8dc149;}._d:before{content:"\\E01D";color:#cc3e44;}._dart:before{content:"\\E01E";color:#519aba;}._db:before{content:"\\E01F";color:#f55385;}._default:before{content:"\\E020";color:#d4d7d6;}._docker:before{content:"\\E022";color:#519aba;}._docker_1:before{content:"\\E022";color:#4d5a5e;}._docker_2:before{content:"\\E022";color:#8dc149;}._docker_3:before{content:"\\E022";color:#f55385;}._ejs:before{content:"\\E024";color:#cbcb41;}._elixir:before{content:"\\E025";color:#a074c4;}._elixir_script:before{content:"\\E026";color:#a074c4;}._elm:before{content:"\\E027";color:#519aba;}._eslint:before{content:"\\E029";color:#a074c4;}._eslint_1:before{content:"\\E029";color:#4d5a5e;}._ethereum:before{content:"\\E02A";color:#519aba;}._f-sharp:before{content:"\\E02B";color:#519aba;}._favicon:before{content:"\\E02C";color:#cbcb41;}._firebase:before{content:"\\E02D";color:#e37933;}._firefox:before{content:"\\E02E";color:#e37933;}._font:before{content:"\\E030";color:#cc3e44;}._git:before{content:"\\E031";color:#41535b;}._go:before{content:"\\E035";color:#519aba;}._go2:before{content:"\\E036";color:#519aba;}._gradle:before{content:"\\E037";color:#8dc149;}._grails:before{content:"\\E038";color:#8dc149;}._graphql:before{content:"\\E039";color:#f55385;}._grunt:before{content:"\\E03A";color:#e37933;}._gulp:before{content:"\\E03B";color:#cc3e44;}._haml:before{content:"\\E03D";color:#cc3e44;}._happenings:before{content:"\\E03E";color:#519aba;}._haskell:before{content:"\\E03F";color:#a074c4;}._haxe:before{content:"\\E040";color:#e37933;}._haxe_1:before{content:"\\E040";color:#cbcb41;}._haxe_2:before{content:"\\E040";color:#519aba;}._haxe_3:before{content:"\\E040";color:#a074c4;}._heroku:before{content:"\\E041";color:#a074c4;}._hex:before{content:"\\E042";color:#cc3e44;}._html:before{content:"\\E043";color:#519aba;}._html_1:before{content:"\\E043";color:#8dc149;}._html_2:before{content:"\\E043";color:#cbcb41;}._html_3:before{content:"\\E043";color:#e37933;}._html_erb:before{content:"\\E044";color:#cc3e44;}._ignored:before{content:"\\E045";color:#41535b;}._illustrator:before{content:"\\E046";color:#cbcb41;}._image:before{content:"\\E047";color:#a074c4;}._info:before{content:"\\E048";color:#519aba;}._ionic:before{content:"\\E049";color:#519aba;}._jade:before{content:"\\E04A";color:#cc3e44;}._java:before{content:"\\E04B";color:#cc3e44;}._javascript:before{content:"\\E04C";color:#cbcb41;}._javascript_1:before{content:"\\E04C";color:#e37933;}._javascript_2:before{content:"\\E04C";color:#519aba;}._jenkins:before{content:"\\E04D";color:#cc3e44;}._jinja:before{content:"\\E04E";color:#cc3e44;}._json:before{content:"\\E050";color:#cbcb41;}._json_1:before{content:"\\E050";color:#8dc149;}._julia:before{content:"\\E051";color:#a074c4;}._karma:before{content:"\\E052";color:#8dc149;}._kotlin:before{content:"\\E053";color:#e37933;}._less:before{content:"\\E054";color:#519aba;}._license:before{content:"\\E055";color:#cbcb41;}._license_1:before{content:"\\E055";color:#e37933;}._license_2:before{content:"\\E055";color:#cc3e44;}._liquid:before{content:"\\E056";color:#8dc149;}._livescript:before{content:"\\E057";color:#519aba;}._lock:before{content:"\\E058";color:#8dc149;}._lua:before{content:"\\E059";color:#519aba;}._makefile:before{content:"\\E05A";color:#e37933;}._makefile_1:before{content:"\\E05A";color:#a074c4;}._makefile_2:before{content:"\\E05A";color:#6d8086;}._makefile_3:before{content:"\\E05A";color:#519aba;}._markdown:before{content:"\\E05B";color:#519aba;}._maven:before{content:"\\E05C";color:#cc3e44;}._mdo:before{content:"\\E05D";color:#cc3e44;}._mustache:before{content:"\\E05E";color:#e37933;}._npm:before{content:"\\E060";color:#41535b;}._npm_1:before{content:"\\E060";color:#cc3e44;}._npm_ignored:before{content:"\\E061";color:#41535b;}._nunjucks:before{content:"\\E062";color:#8dc149;}._ocaml:before{content:"\\E063";color:#e37933;}._odata:before{content:"\\E064";color:#e37933;}._pddl:before{content:"\\E065";color:#a074c4;}._pdf:before{content:"\\E066";color:#cc3e44;}._perl:before{content:"\\E067";color:#519aba;}._photoshop:before{content:"\\E068";color:#519aba;}._php:before{content:"\\E069";color:#a074c4;}._plan:before{content:"\\E06A";color:#8dc149;}._platformio:before{content:"\\E06B";color:#e37933;}._powershell:before{content:"\\E06C";color:#519aba;}._prolog:before{content:"\\E06E";color:#e37933;}._pug:before{content:"\\E06F";color:#cc3e44;}._puppet:before{content:"\\E070";color:#cbcb41;}._python:before{content:"\\E071";color:#519aba;}._react:before{content:"\\E073";color:#519aba;}._react_1:before{content:"\\E073";color:#e37933;}._react_2:before{content:"\\E073";color:#cbcb41;}._reasonml:before{content:"\\E074";color:#cc3e44;}._rollup:before{content:"\\E075";color:#cc3e44;}._ruby:before{content:"\\E076";color:#cc3e44;}._rust:before{content:"\\E077";color:#6d8086;}._salesforce:before{content:"\\E078";color:#519aba;}._sass:before{content:"\\E079";color:#f55385;}._sbt:before{content:"\\E07A";color:#519aba;}._scala:before{content:"\\E07B";color:#cc3e44;}._shell:before{content:"\\E07E";color:#4d5a5e;}._slim:before{content:"\\E07F";color:#e37933;}._smarty:before{content:"\\E080";color:#cbcb41;}._spring:before{content:"\\E081";color:#8dc149;}._stylelint:before{content:"\\E082";color:#d4d7d6;}._stylelint_1:before{content:"\\E082";color:#4d5a5e;}._stylus:before{content:"\\E083";color:#8dc149;}._sublime:before{content:"\\E084";color:#e37933;}._svg:before{content:"\\E085";color:#a074c4;}._svg_1:before{content:"\\E085";color:#519aba;}._swift:before{content:"\\E086";color:#e37933;}._terraform:before{content:"\\E087";color:#a074c4;}._tex:before{content:"\\E088";color:#519aba;}._tex_1:before{content:"\\E088";color:#cbcb41;}._tex_2:before{content:"\\E088";color:#e37933;}._tex_3:before{content:"\\E088";color:#d4d7d6;}._todo:before{content:"\\E08A;";}._tsconfig:before{content:"\\E08B";color:#519aba;}._twig:before{content:"\\E08C";color:#8dc149;}._typescript:before{content:"\\E08D";color:#519aba;}._typescript_1:before{content:"\\E08D";color:#cbcb41;}._vala:before{content:"\\E08E";color:#6d8086;}._video:before{content:"\\E08F";color:#f55385;}._vue:before{content:"\\E090";color:#8dc149;}._wasm:before{content:"\\E091";color:#a074c4;}._wat:before{content:"\\E092";color:#a074c4;}._webpack:before{content:"\\E093";color:#519aba;}._wgt:before{content:"\\E094";color:#519aba;}._windows:before{content:"\\E095";color:#519aba;}._word:before{content:"\\E096";color:#519aba;}._xls:before{content:"\\E097";color:#8dc149;}._xml:before{content:"\\E098";color:#e37933;}._yarn:before{content:"\\E099";color:#519aba;}._yml:before{content:"\\E09A";color:#a074c4;}._zip:before{content:"\\E09B";color:#cc3e44;}._zip_1:before{content:"\\E09B";color:#6d8086;}';
    }
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
            .colicon { float:left; font-size:2em;height:1em;width:1em;font-family:"seti";         \
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
            <a class="item parent"><div class="colicon"></div><div class="coltext">    \
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
    insertStyleHtml(iconStyle + fileIndexStyle, fileIndexHtml, indexBox);

    // locals =====================================================//
    var currentLink = "";
    var fileList = [], folderList = [];
    var procFileList = [], procFolderList = [];
    var nameOrder = false, timeOrder = false, sizeOrder = false; // false means sort small -> big

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
    var viewer = (enViewer) ? new FileViewer(viewBox, { "refresh": refresh, "adminCore": adminCore }) : null;

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
        var feature = "";
        if (name == "folder") return "_folder" + feature;
        if (name == "pFolder") return "_folder" + feature;
        // fileNames
        var type = iconType.fileNames[name];
        if (typeof type != "undefined") return type + feature;
        // suffix
        var suffix = name.slice(name.lastIndexOf(".")+1);
        type = iconType.languageIds[suffix];
        if (typeof type != "undefined") return type + feature;        
        type = iconType.fileExtensions[suffix];
        if (typeof type != "undefined") return type + feature;
        return "_default" + feature;
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
                + '<div class="colicon ' + chooseIcon('folder') + '"></div>'
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
        listPDir.querySelector(".colicon").className = "colicon " + chooseIcon("pFolder");
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


