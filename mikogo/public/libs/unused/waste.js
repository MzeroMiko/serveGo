function MenuViewerOri(menuBox, opts) {
    // parse Parameter ============================================//
    if (typeof menuBox == "string") menuBox = document.querySelector(menuBox);
    if (typeof opts == "undefined") opts = {};
    var backColor = ("backColor" in opts) ? opts.backColor : "#ccc";
    var fontColor = ("fontColor" in opts) ? opts.fontColor : "#fff";
    var infoTime = ("infoTime" in opts) ? opts.infoTime : 15000; // ms
    var reAuthTime = ("reAuthTime" in opts) ? opts.reAuthTime : 5; // min
    var fontSize = ("fontSize" in opts) ? opts.fontSize : "16px";
    var popupZIndex = ("popupZIndex" in opts) ? opts.popupZIndex : 1; // z-index
    var downFile = ("downFile" in opts) ? opts.downFile : function (link) { window.open(link); };
    var refresh = ("refresh" in opts) ? opts.refresh : function () { };

    var titleColor = "#8ae";
    var downColor = "#bea", uploadColor = "#9e9", mkdirColor = "#dd9";
    var renameColor = "#9dd", deleteColor = "#d9d", authColor = "#ea9";

    var menuStyle = '__ID__ .item {cursor: pointer;display: inline-block; text-decoration: none; padding: 0.3em;margin: 0.2em; min-width:5em;text-align:center;color:' + fontColor + ';}';

    var menuHtml = '<div class="footer" style="position:absolute;right:0;bottom:0;left:0;">\
    <div class="backdrop" style="display:none;justify-content:space-between;padding:0.2em;\
    font-weight: 600;font-size: ' + fontSize + ';background: ' + backColor + ';">\
    <a class="item title" style="background:'+ titleColor + ';word-break:break-all;"></a>\
    <div style="text-align:right;">\
    <a class="item download" style="background:'+ downColor + ';">download</a>\
    <a class="item upload" style="background:'+ uploadColor + ';">upload</a>\
    <a class="item mkdir" style="background:'+ mkdirColor + ';">mkdir</a>\
    <a class="item rename" style="background:'+ renameColor + ';">rename</a>\
    <a class="item delete" style="background:'+ deleteColor + ';">delete</a>\
    <a class="item admin" style="background:'+ authColor + ';">login</a>\
    </div></div></div>';

    function insertStyleHtml(styleText, htmlText, container, uniqueIDSign) {
        if (typeof uniqueIDSign == "undefined") uniqueIDSign = "__ID__";
        var uniqueID = "";
        while (1) {
            uniqueID = ".ID" + Math.floor((new Date().getTime() * Math.random()));
            if (document.querySelector(uniqueID) == null) break;
        }
        scopedStyle = styleText.replace(new RegExp(uniqueIDSign, "g"), uniqueID);
        if (scopedStyle.indexOf('<style') == -1) scopedStyle = '<style>' + scopedStyle + '</style>';
        container.className += " " + uniqueID.slice(1), container.innerHTML = scopedStyle + htmlText;
    }
    insertStyleHtml(menuStyle, menuHtml, menuBox);

    var currentToken = "", menuTimeout, authTimeOut;
    var currentLink, currentDirLink, currentDirPath;

    var uploadBox = document.createElement("div");
    var popupBox = document.createElement("div");
    uploadBox.style = "position:fixed;top:10%;left:50%;transform:translate(-50%,0);"
    popupBox.style = "position:fixed;top:10%;left:50%;transform:translate(-50%,0);z-index:" + popupZIndex + ";";
    document.body.appendChild(uploadBox);
    document.body.appendChild(popupBox);
    var adminCore = new AdminCore();
    var popupMenu = new PopupMenu(popupBox);

    var footer = menuBox.querySelector(".footer");
    var backdrop = footer.querySelector('.backdrop');
    var title = backdrop.querySelector(".title");
    var downBtn = backdrop.querySelector(".download");
    var uploadBtn = backdrop.querySelector(".upload");
    var mkdirBtn = backdrop.querySelector(".mkdir");
    var renameBtn = backdrop.querySelector(".rename");
    var deleteBtn = backdrop.querySelector(".delete");
    var adminBtn = backdrop.querySelector(".admin");

    title.onclick = function () { resetHide(); backdrop.style.display = "none"; }
    downBtn.onclick = function () { resetHide(); downFile(currentLink); return false; }
    uploadBtn.onclick = function () { resetHide(); upload(currentDirLink); }
    mkdirBtn.onclick = function () { resetHide(); mkdir(currentDirLink); }
    renameBtn.onclick = function () { resetHide(); rename(currentDirPath, currentLink); }
    deleteBtn.onclick = function () { resetHide(); remove(currentLink); }
    adminBtn.onclick = function () {
        resetHide();
        if (adminBtn.innerText == "logout") closeSession(currentDirLink);
        else askAuth(currentDirLink);
    }

    function getName(link) {
        var name = decodeURIComponent(link);
        name = name.slice(name.lastIndexOf("/") + 1);
        return (name == "") ? "home" : name;
    }
    function resetHide() {
        try { clearTimeout(menuTimeout) } catch (err) { }
        menuTimeout = setTimeout(function () { backdrop.style.display = "none"; }, infoTime);
    }
    function resetToken(targetLink, time) {
        if (typeof time == "undefined") time = reAuthTime * 60 * 1000; // ms
        try { clearTimeout(authTimeOut); } catch (err) { }
        authTimeOut = setTimeout(function () {
            adminCore.closeSessionCore(targetLink, function () { adminBtn.innerText = "login"; });
        }, time);
    }
    function popupInfo(message) {
        if (message.indexOf("pass") == 0)
            popupMenu.appendMessage("pass", message.slice("pass".length));
        else if (message.indexOf("fail") == 0)
            popupMenu.appendMessage("fail", message.slice("fail".length));
        else if (message.indexOf("warn") == 0)
            popupMenu.appendMessage("warn", message.slice("warn".length));
        else
            popupMenu.appendMessage("info", message);
    }
    function askAuth(targetLink, passCallBack) {
        popupMenu.appendAuth(function (name, key) {
            if (!key) return false;
            adminCore.askAuthCore(key, targetLink, function (token) {
                currentToken = token;
                adminBtn.innerText = "logout";
                if (typeof passCallBack != "undefined") passCallBack();
            }, function (result) {
                resetToken(targetLink, 16);
                popupMenu.appendMessage("fail", "Authorization Fail");
            });
        });
    }
    function closeSession(targetLink) {
        if (currentToken == "") return resetToken(targetLink, 16);
        popupMenu.appendMessage("confirm", "Are you sure to log out?", function () {
            resetToken(targetLink, 16);
        });
    }
    function mkdir(targetLink) {
        if (currentToken == "") return askAuth(targetLink, function () { mkdir(targetLink) });
        popupMenu.appendMessage("input", { message: "Directory Name:", input: "New_Directory" },
            function (name) {
                if (!name) return;
                adminCore.mkdirCore(targetLink + encodeURIComponent("/" + name),
                    function (result) { refresh(); popupInfo(result); },
                    function () { askAuth(targetLink, function () { mkdir(targetLink) }); });
            }
        );
    }
    function remove(targetLink) {
        if (currentToken == "") return askAuth(targetLink, function () { remove(targetLink) });
        var name = decodeURIComponent(targetLink);
        name = name.slice(name.lastIndexOf("/") + 1);
        popupMenu.appendMessage("confirm", "remove file: " + name + " ? ", function () {
            adminCore.removeCore(targetLink,
                function (result) { refresh(); popupInfo(result); },
                function () { askAuth(targetLink, function () { remove(targetLink) }); })
        });
    }
    function rename(targetDirPath, targetLink) {
        if (currentToken == "")
            return askAuth(targetLink, function () { rename(targetDirPath, targetLink); });
        var oriName = decodeURIComponent(targetLink);
        oriName = oriName.slice(oriName.lastIndexOf("/") + 1);
        popupMenu.appendMessage("input", { message: "new name for " + oriName + " : ", input: oriName },
            function (newName) {
                if (!newName) return;
                var newPath = targetDirPath + encodeURIComponent("/" + newName);
                adminCore.renameCore(targetLink, newPath,
                    function (result) { refresh(); popupInfo(result); },
                    function () { askAuth(targetLink, function () { rename(targetDirPath, targetLink); }); });
            }
        );
    }
    function upload(targetLink) {
        if (currentToken == "") return askAuth(targetLink, function () { upload(targetLink); });
        new UploadMenu(uploadBox,
            function (file, callback) { adminCore.uploadFile(file, targetLink, callback); },
            { "uploadCallBack": function () { refresh(); } }
        );
    }

    this.closeAll = function () {
        title.innerText = "";
        backdrop.style.display = "none";
    }

    this.setMenu = function (targetLink, isFolder) {
        resetHide();
        currentLink = targetLink;
        downBtn.href = targetLink;
        backdrop.style.display = "flex";
        if (targetLink == currentDirLink && isFolder) {
            // menu for upload and mkdir
            downBtn.style.display = "none";
            uploadBtn.style.display = "";
            mkdirBtn.style.display = "";
            renameBtn.style.display = "none";
            deleteBtn.style.display = "none";
            title.innerText = "current: " + getName(targetLink);
        } else if (isFolder) {
            downBtn.style.display = "none";
            uploadBtn.style.display = "none";
            mkdirBtn.style.display = "none";
            renameBtn.style.display = "";
            deleteBtn.style.display = "";
            title.innerText = "folder: " + getName(targetLink);
        } else {
            downBtn.style.display = "";
            uploadBtn.style.display = "none";
            mkdirBtn.style.display = "none";
            renameBtn.style.display = "";
            deleteBtn.style.display = "";
            title.innerText = "file: " + getName(targetLink);
        }
    }

    this.setPathLink = function (dirPath, dirLink) {
        currentDirPath = dirPath;
        currentDirLink = dirLink;
    }
}

function UploadMenuOri(uploadBox, uploadFileCore, opts) {
    // uploadFileCore: function (file, callback(progress, status){}){}
    if (typeof opts == "undefined") opts = {};
    var basicSize = ("basicSize" in opts) ? opts.basicSize : "14px";
    var backColor = ("backColor" in opts) ? opts.backColor : "#aca";
    var contentColor = ("contentColor" in opts) ? opts.contentColor : "#efe";
    var fontColor = ("fontColor" in opts) ? opts.fontColor : "#fff";
    var finishCallBack = ("uploadCallBack" in opts) ? opts.uploadCallBack : function () { };
    var endStatus = ("enStatus" in opts) ? opts.endStatus : ["finish", "exist", "chunked", "fail", "authFail"];

    { // uploadMenuStyle
        var uploadMenuStyle = '\
        __ID__ .titleBar, __ID__ .ctrlBar {height:2em;overflow:hidden;font-size:1.2em;\
            border-bottom: 0.2em solid '+ fontColor + ';} \
        __ID__ .selectBtn, __ID__  .clearBtn, __ID__ .uploadBtn, __ID__ .foldBtn,\
        __ID__ .info {cursor: pointer;padding: 0.4em;display: inline-block;}\
        __ID__ .foldBtn, __ID__ .clearBtn {float: right;}\
        __ID__ .foldBtn {font-weight:900;}\
        __ID__  .content {max-height: 32em;min-height:4em;overflow-y:auto;margin-bottom:0.4em;}\
        __ID__ .item {height:2.5em;position:relative;overflow:hidden;color:#233;\
            background:'+ contentColor + ';border-bottom: 1px solid ' + backColor + ';}\
        __ID__ .coltext {position: absolute;top: 0;right: 0;bottom: 0;left: 0; }\
        __ID__ .colname, __ID__ .colstat, __ID__ .colsize {float:left;\
          overflow: auto;padding: 0.7em 1%;white-space: nowrap;}\
        __ID__ .colname {width: 50%;text-align: left;}\
        __ID__ .colsize {width: 24%;text-align: right;}\
        __ID__ .colstat {cursor: pointer; width: 20%;text-align: center;}\
        __ID__ .progress {width:0%;top:0;bottom:0;left:0;position:absolute;background:'+ backColor + ';}';
    }
    { // uploadMenuHtml
        var fileBarHtml = '<div class="progress"></div><div class="coltext"><div class="colname"></div><div class="colsize"></div><div class="colstat">wait</div></div>';

        var uploadMenuHtml = '\
        <div class="backdrop"style="font-size:'+ basicSize + ';color: ' + fontColor + ';\
        background:'+ backColor + ';font-weight:600;width:24em;padding:0.3em;border-radius:0.5em;">\
        <div class="titleBar"><div class="info">upload 0/0</div>\
        <div class="foldBtn">x</div></div>\
        <div class="ctrlBar"><div class="selectBtn">select</div>\
        <div class="uploadBtn">upload</div><div class="clearBtn">clear</div></div>\
        <div class="content"></div><div class="fileInputs" style="display: none;"></div></div>';
    }
    function insertStyleHtml(styleText, htmlText, container, uniqueIDSign) {
        if (typeof uniqueIDSign == "undefined") uniqueIDSign = "__ID__";
        var uniqueID = "";
        while (1) {
            uniqueID = ".ID" + Math.floor((new Date().getTime() * Math.random()));
            if (document.querySelector(uniqueID) == null) break;
        }
        scopedStyle = styleText.replace(new RegExp(uniqueIDSign, "g"), uniqueID);
        if (scopedStyle.indexOf('<style') == -1) scopedStyle = '<style>' + scopedStyle + '</style>';
        container.className += " " + uniqueID.slice(1), container.innerHTML = scopedStyle + htmlText;
    }
    insertStyleHtml(uploadMenuStyle, uploadMenuHtml, uploadBox);

    var backdrop = uploadBox.querySelector(".backdrop");
    var info = backdrop.querySelector(".info");
    var foldBtn = backdrop.querySelector(".foldBtn");
    var ctrlBar = backdrop.querySelector(".ctrlBar");
    var content = backdrop.querySelector(".content");
    var selectBtn = backdrop.querySelector(".selectBtn");
    var uploadBtn = backdrop.querySelector(".uploadBtn");
    var clearBtn = backdrop.querySelector(".clearBtn");
    var fileInputs = backdrop.querySelector(".fileInputs");

    var onUpload = false, uploadFinish = false;
    var uploadFinished = 0, uploadTotal = 0;
    var fileObjectList = []; // files
    var fileSkipList = []; // skip these files

    clearBtn.onclick = function () { resetFile(); }

    foldBtn.onclick = function () {
        if (foldBtn.innerText == "x") {
            resetFile();
            uploadBox.innerHTML = ""; // remove all
        } else {
            if (ctrlBar.style.display == "none") {
                ctrlBar.style.display = "";
                content.style.display = "";
                if (uploadFinished == uploadTotal) foldBtn.innerText = "x";
            } else {
                ctrlBar.style.display = "none";
                content.style.display = "none";
            }

        }

    }

    selectBtn.onclick = function () {
        if (uploadFinish) resetFile();
        if (onUpload) return;
        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = "multiple";
        var index = fileInputs.childNodes.length;
        fileInput.className = "filesInputs" + index.toString();
        fileInputs.appendChild(fileInput);
        fileInput.onchange = function () {
            var files = fileInput.files;
            var fileNum = files.length;
            var oriFileNum = fileObjectList.length;
            for (var i = 0; i < fileNum; i++) {
                fileObjectList.push(files[i]);
                var index = oriFileNum + i;
                appendFile(fileObjectList[index], index);
            }
            info.innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
        }
        fileInput.click();
    }

    uploadBtn.onclick = function () {
        if (onUpload || uploadFinish) return;
        onUpload = true;
        foldBtn.innerText = "+";
        uploadFiles(0, fileObjectList, setCurrent);
    }

    function formatSize(sizeB) {
        // Cautions: >> is limited to 32bit signed int, 1<<31 
        var GB = 1 << 30, MB = 1 << 20, KB = 1 << 10;
        if (sizeB > GB) return (sizeB / GB).toFixed(3) + "G";
        else if (sizeB > MB) return (sizeB / MB).toFixed(3) + "M";
        else if (sizeB > KB) return (sizeB / KB).toFixed(3) + "K";
        else return sizeB.toString() + "B";
    }

    function resetFile() {
        onUpload = false; uploadFinish = false;
        var nodes = fileInputs.childNodes;
        var nodeNum = nodes.length;
        for (var i = 0; i < nodeNum; i++)
            nodes[i].value = ''; // clear file input
        fileInputs.innerHTML = ''; // clear Html
        content.innerHTML = '';
        uploadTotal = 0, uploadFinished = 0;
        fileObjectList = [], fileSkipList = [];
        info.innerText = "upload 0/0";
    }

    function appendFile(file, index) {
        var cFile = document.createElement('div');
        cFile.className = "item file" + index.toString();
        cFile.innerHTML = fileBarHtml;
        cFile.querySelector(".colname").innerText = file.name;
        cFile.querySelector(".colsize").innerText = formatSize(file.size);
        uploadTotal += 1;
        var status = cFile.querySelector(".colstat");
        status.onclick = function () {
            if (status.innerText == "wait") {
                fileSkipList.push(Number(cFile.className.slice("item file".length)));
                content.removeChild(cFile);
                uploadTotal -= 1;
                info.innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
            }
        }
        content.appendChild(cFile);
    }

    function setCurrent(index, progress, status) {
        // status: wait / md5 / upload / finish / exist / chunked / fail / authFail 
        try {
            var cFile = content.querySelector(".file" + index + "");
            cFile.querySelector(".progress").style.width = (100 * progress).toString() + "%";
            cFile.querySelector(".colstat").innerText = status;
            if (endStatus.indexOf(status) != -1) {
                uploadFinished += 1;
                info.innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
                if (uploadFinished == uploadTotal) { // upload finished
                    uploadFinish = true;
                    if (ctrlBar.style.display == "") foldBtn.innerText = "x"; // else still can fold
                    finishCallBack();
                }
            }
        } catch (err) { console.log(err.toString()) }
    }

    function uploadFiles(index, fileObjectList, callback) {
        if (!fileObjectList.length || index == fileObjectList.length) return;
        if (fileSkipList.indexOf(index) != -1) {
            uploadFiles(index + 1, fileObjectList, callback);
            return;
        }
        uploadFileCore(fileObjectList[index], function (progress, status) {
            callback(index, progress, status);
            if (endStatus.indexOf(status) != -1)
                uploadFiles(index + 1, fileObjectList, callback);
        });
    }
}


var uploadHtml = '<div style="position:absolute;top:0;right:0;left:0;border-bottom: 0.2em solid ' + fontColor + ';color:' + fontColor + ';font-weight:600;">\
<div class="menuBtn clear" style="float:right;">clear</div>\
<div class="menuBtn select" style="float:right;">select</div>\
<div class="menuBtn info">upload 0 / 0</div></div>\
<div class="uploadList" style="position:absolute;top:3em;right:0;left:0;bottom:0;overflow:auto;">\
</div>\
<div class="fileInputs" style="display: none;"></div>\
';

var uploadBox = document.createElement('div');
uploadBox.style = "width:100%;height:100%;";
uploadBox.innerHTML = uploadHtml;

var onUpload = false, uploadFinish = false;
var uploadFinished = 0, uploadTotal = 0;
var fileObjectList = []; // files
var fileSkipList = []; // skip these files
var uploadFileCore = adminCore.uploadFile;
var uploadFinishCallBack = refresh;
var endStatus = ["finish", "exist", "chunked", "fail", "authFail"];

uploadBox.querySelector(".clear").onclick = function () { 
onUpload = false; uploadFinish = false;
var fileInputs = uploadBox.querySelector(".fileInputs");
var nodes = fileInputs.childNodes;
var nodeNum = nodes.length;
for (var i = 0; i < nodeNum; i++)
    nodes[i].value = ''; // clear file input
fileInputs.innerHTML = ''; // clear Html
uploadBox.querySelector('.uploadList').innerHTML = '';
uploadTotal = 0, uploadFinished = 0;
fileObjectList = [], fileSkipList = [];
uploadBox.querySelector(".info").innerText = "upload 0/0"; 
}
uploadBox.querySelector(".select").onclick = function () {
if (uploadFinish) 
    uploadBox.querySelector(".clear").click;
if (onUpload) return;
var fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.multiple = "multiple";
var info = uploadBox.querySelector(".info");
var fileInputs = uploadBox.querySelector(".fileInputs");
var index = fileInputs.childNodes.length;
fileInput.className = "filesInputs" + index.toString();
fileInputs.appendChild(fileInput);
fileInput.onchange = function () {
    var files = fileInput.files;
    var fileNum = files.length;
    var oriFileNum = fileObjectList.length;
    for (var i = 0; i < fileNum; i++) {
        fileObjectList.push(files[i]);
        var index = oriFileNum + i;
        var file = fileObjectList[index];
        appendItem(index, uploadBox.querySelector('.uploadList'), function (coreItem) {
            coreItem.innerHTML = '<div class="uploadProgress"></div><div class="coltext"><div class="colname"></div><div class="colsize"></div><div class="colstat"></div></div></div>';
            coreItem.querySelector(".colname").innerText = file.name;
            coreItem.querySelector(".colsize").innerText = formatSize(file.size);
            uploadTotal += 1;
        }, function (index, coreItem) {
            if (coreItem.querySelector('.colstat').innerText == "wait") {
                fileSkipList.push(index);
                uploadTotal -= 1;
                info.innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
            }
        });
    }
    info.innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
}
fileInput.click();
}
function formatSize(sizeB) {
// Cautions: >> is limited to 32bit signed int, 1<<31 
var GB = 1 << 30, MB = 1 << 20, KB = 1 << 10;
if (sizeB > GB) return (sizeB / GB).toFixed(3) + "G";
else if (sizeB > MB) return (sizeB / MB).toFixed(3) + "M";
else if (sizeB > KB) return (sizeB / KB).toFixed(3) + "K";
else return sizeB.toString() + "B";
}    
function setCurrent(index, progress, status) {
// status: wait / md5 / upload / finish / exist / chunked / fail / authFail 
try {
    percent = (100 * progress).toFixed(2) + "%";
    filesize = cFile.querySelector(".colsize").indexOf("@");
    filesize = cFile.querySelector(".colsize").slice(filesize + 1);
    var cFile = uploadBox.querySelector(".file" + index + "");
    cFile.querySelector(".progress").style.width = percent;
    cFile.querySelector(".colsize") = percent + "@" + filesize;
    cFile.querySelector(".colstat").innerText = status;
    if (endStatus.indexOf(status) != -1) {
        uploadFinished += 1;
        uploadBox.querySelector(".info").innerText = "upload " + uploadFinished.toString() + "/" + uploadTotal.toString();
        if (uploadFinished == uploadTotal) { // upload finished
            uploadFinish = true;
            uploadFinishCallBack();
        }
    }
} catch (err) { console.log(err.toString()) }
}
function uploadFiles(index, fileObjectList, callback) {
if (!fileObjectList.length || index == fileObjectList.length) return;
if (fileSkipList.indexOf(index) != -1) {
    uploadFiles(index + 1, fileObjectList, callback);
    return;
}
uploadFileCore(fileObjectList[index], function (progress, status) {
    callback(index, progress, status);
    if (endStatus.indexOf(status) != -1)
        uploadFiles(index + 1, fileObjectList, callback);
});
}
function uploadClick() {
if (onUpload || uploadFinish) return;
onUpload = true;
uploadFiles(0, fileObjectList, setCurrent);
} 


function insertStyleHtmlOri(styleText, htmlText, container, uniqueIDSign) {
    if (typeof uniqueIDSign == "undefined") uniqueIDSign = "__ID__";
    var uniqueID = "";
    while (1) {
        uniqueID = ".ID" + Math.floor((new Date().getTime() * Math.random()));
        if (document.querySelector(uniqueID) == null) break;
    }
    scopedStyle = styleText.replace(new RegExp(uniqueIDSign, "g"), uniqueID);
    if (scopedStyle.indexOf('<style') == -1) scopedStyle = '<style>' + scopedStyle + '</style>';
    container.className += " " + uniqueID.slice(1), container.innerHTML = scopedStyle + htmlText;
}

function getName(link) {
    var name = decodeURIComponent(link);
    name = name.slice(name.lastIndexOf("/") + 1);
    return (name == "") ? "home" : name;
}




var Style = `<style ,,,,> .hljs{display:block;overflow-x:auto;padding:.5em;background:white;color:black} .hljs-comment, .hljs-quote, .hljs-variable{color:#008000} .hljs-keyword, .hljs-selector-tag, .hljs-built_in,
.hljs-name, .hljs-tag{color:#00f}
.hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-addition{color:#a31515} .hljs-deletion, .hljs-selector-attr, .

hljs-selector-pseudo, .hljs-meta{color:#2b91af} .hljs-doctag{color:#808080} .hljs-attr{color:#f00} .hljs-symbol, .hljs-bullet, .hljs-link{color:#00b0e8} .hljs-emphasis{font-style:italic} .hljs-strong{font-weight:bold}</style>`;
console.log(uniqueStyle(Style));


{
    var orderBtnHtml = '<div style="height:1em;width:1em;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;">'
        + '<div class="orderStat" style="font-size:0.6em;font-weight:800;overflow:hidden;'
        + 'color:' + themeColor + '; ">A</div></div>';
    var playBtnHtml = '<div style="background:' + playBtnColor + ';border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="width:0.1em;height:0.5em;"></div>'
        + '<div style="width:0;height:0;border-left:0.5em solid ' + themeColor + ';'
        + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
        + '</div>';
    var pauseBtnHtml = '<div style="background:' + playBtnColor + ';border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="width:0.17em;height:0.5em;background:' + themeColor + ';"></div>'
        + '<div style="width:0.16em;height:0.5em;background:transparent;"></div>'
        + '<div style="width:0.17em;height:0.5em;background:' + themeColor + ';"></div>'
        + '</div>';
    var prevBtnHtml = '<div style="background:transparent;border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="width:0.1em;height:0.5em;background:' + themeColor + ';"></div>'
        + '<div style="width:0;height:0;border-right:0.4em solid ' + themeColor + ';'
        + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
        + '</div>';
    var nextBtnHtml = '<div style="background:transparent;border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="width:0;height:0;border-left:0.4em solid ' + themeColor + ';'
        + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
        + '<div style="width:0.1em;height:0.5em;background:' + themeColor + ';"></div>'
        + '</div>';
    var volBtnHtml = '<div style="background:transparent;border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="width:0.16em;height:0.24em;background:' + themeColor + ';"></div>'
        + '<div style="width:0;height:0.24em;border-right:0.24em solid ' + themeColor + ';'
        + 'box-sizing:content-box;'
        + 'border-top:0.13em solid transparent;border-bottom:0.13em solid transparent;"></div>'
        + '<div style="width:0.1em;height:0.5em;"></div>'
        + '</div>';
    var fullBtnHtml = '<div style="background:transparent;border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="border:0.05em solid transparent;padding:0.15em;">'
        + '<div style="height:0.2em;width:0.5em;display:flex;'
        + 'justify-content:flex-start;align-items:flex-start;">'
        + '<div style="height:0.2em;width:0.05em;background:' + themeColor + ';"></div>'
        + '<div style="height:0.05em;width:0.15em;background:' + themeColor + ';"></div></div>'
        + '<div style="height:0.1em;width:0.5em;"></div>'
        + '<div style="height:0.2em;width:0.5em;display:flex;'
        + 'justify-content:flex-end;align-items:flex-end;">'
        + '<div style="height:0.05em;width:0.15em;background:' + themeColor + ';"></div>'
        + '<div style="height:0.2em;width:0.05em;background:' + themeColor + ';"></div></div>'
        + '</div></div>';
    var noFullBtnHtml = '<div style="background:transparent;border-radius:50%;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
        + '<div style="border:0.05em solid transparent;padding:0.15em;">'
        + '<div style="height:0.2em;width:0.5em;display:flex;'
        + 'justify-content:flex-start;align-items:flex-end;">'
        + '<div style="height:0.05em;width:0.15em;background:' + themeColor + ';"></div>'
        + '<div style="height:0.2em;width:0.05em;background:' + themeColor + ';"></div></div>'
        + '<div style="height:0.1em;width:0.5em;"></div>'
        + '<div style="height:0.2em;width:0.5em;display:flex;'
        + 'justify-content:flex-end;align-items:flex-start;">'
        + '<div style="height:0.2em;width:0.05em;background:' + themeColor + ';"></div>'
        + '<div style="height:0.05em;width:0.15em;background:' + themeColor + ';"></div></div>'
        + '</div></div>';
}

function MediaPlayerMod(mediaBox, opts) {
    // parameter ============================================//
    if (typeof mediaBox == "string") mediaBox = document.querySelector(mediaBox);
    if (typeof opts == "undefined") opts = {};
    var media = ("media" in opts) ? opts.media : "";
    if (media && (typeof media == "string")) media = document.querySelector(media);
    var enFullScreen = ("enFullScreen" in opts) ? opts.enFullScreen : false;
    var enMediaName = ("enMediaName" in opts) ? opts.enMediaName : true;
    var forwardStep = ("forwardStep" in opts) ? opts.forwardStep : 3;
    var backColor = ("backColor" in opts) ? opts.backColor : "#777";
    var themeColor = ("themeColor" in opts) ? opts.themeColor : "#fff";
    var ctrlBtnSize = ("ctrlBtnSize" in opts) ? opts.ctrlBtnSize : "32px";
    var playBtnColor = ("playBtnColor" in opts) ? opts.playBtnColor : "#aeb";
    var volSliderColor = ("volSliderColor" in opts) ? opts.volSliderColor : "#3dd";
    var timeSliderColor = ("timeSliderColor" in opts) ? opts.timeSliderColor : "#2d3";
    var sliderBufferColor = ("sliderBufferColor" in opts) ? opts.sliderBufferColor : "#aaa";
    var stopCallBack = ("stopCallBack" in opts) ? opts.stopCallBack : function () { };
    var fullScreenEle = ("fullScreenEle" in opts) ? opts.fullScreenEle : document.documentElement;
    var enterFullScreenCallBack =
        ("enterFullScreenCallBack" in opts) ? opts.enterFullScreenCallBack : function () { };
    var exitFullScreenCallBack =
        ("exitFullScreenCallBack" in opts) ? opts.exitFullScreenCallBack : function () { };

    // html and style =========================================//
    { // icons
        var fullIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 17 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-arrow-fullscreen'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M16.196.083h-3.867a.69.69 0 0 0-.688.69l1.588 1.594-1.917 1.917a.979.979 0 0 0 0 1.39.984.984 0 0 0 1.391 0l1.914-1.915 1.579 1.585c.38 0 .687-.31.687-.69V.773c0-.38-.307-.69-.687-.69zM16.192 10.645l-1.619 1.612-1.952-1.952a.983.983 0 1 0-1.392 1.39l1.951 1.95-1.56 1.554c0 .38.309.687.69.687h3.881c.381 0 .69-.307.69-.687v-3.866a.686.686 0 0 0-.689-.688zM4.758 2.359L6.342.78a.69.69 0 0 0-.691-.687h-3.88a.688.688 0 0 0-.69.687v3.866c0 .381.31.688.69.688l1.595-1.587 1.969 1.968a.978.978 0 0 0 1.39 0 .983.983 0 0 0 0-1.389L4.758 2.359zM5.951 9.645l-2.59 2.59-1.594-1.601a.69.69 0 0 0-.688.69v3.881c0 .381.309.69.688.69h3.867a.69.69 0 0 0 .687-.69L4.75 13.627l2.592-2.592a.982.982 0 1 0-1.391-1.39z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var noFullIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-reduce'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M2.329 9.083a.69.69 0 0 0-.688.69l1.588 1.594L.25 14.269a.979.979 0 0 0 0 1.39.984.984 0 0 0 1.391 0l2.976-2.9 1.579 1.585c.38 0 .687-.31.687-.69V9.773c0-.38-.307-.69-.687-.69H2.329zM4.573 3.257L1.786.209a.983.983 0 0 0-1.392 0 .944.944 0 0 0 0 1.357L3.18 4.645 1.62 6.199c0 .38.309.687.69.687h3.881c.381 0 .69-.307.69-.687V2.333a.686.686 0 0 0-.689-.688L4.573 3.257zM14.342 9.78a.69.69 0 0 0-.691-.687h-3.88a.688.688 0 0 0-.69.687v3.866c0 .381.31.688.69.688l1.595-1.587 2.968 2.976a.978.978 0 0 0 1.39 0 .983.983 0 0 0 0-1.389l-2.966-2.975 1.584-1.579zM11.361 3.235L9.767 1.634a.69.69 0 0 0-.688.69v3.881c0 .381.309.69.688.69h3.867a.69.69 0 0 0 .687-.69L12.75 4.627l2.961-3.073a.982.982 0 0 0 0-1.39c-.383-.384-1.005-.116-1.39.268l-2.96 2.803z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var pauseIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM7 6h2v8H7V6zm4 0h2v8h-2V6z'/%3E%3C/svg%3E";
        var playIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM7 6l8 4-8 4V6z'/%3E%3C/svg%3E";
        var orderRandom = "data:image/svg+xml,%3Csvg viewBox='0 0 17 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-arrow-shuffle'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M12.121 5.958h1.934v.854a.55.55 0 0 0 .778 0l1.965-1.352a.552.552 0 0 0 0-.778l-1.965-1.495a.548.548 0 0 0-.778 0v.849H12.09c-.195-.008-1.936-.032-3.238 1.222-.857.824-1.292 1.662-1.292 3.103 0 .873-.226 1.534-.669 1.964-.697.675-1.771.742-1.818.741H1.084v1.898l4.062.002c.451 0 1.955-.09 3.113-1.194.861-.819 1.297-1.968 1.297-3.411 0-.873.226-1.226.672-1.662.702-.686 1.86-.737 1.893-.741zM16.84 11.687l-2.027-1.52a.55.55 0 0 0-.778 0v.914h-2.154s-.653.008-1.28-.282l-.909 1.653c.964.445 1.906.48 2.163.48l.063-.001h2.117v.901a.55.55 0 0 0 .778 0l2.027-1.369a.55.55 0 0 0 0-.776zM6.555 6.329l1.052-1.618c-1.188-.666-2.445-.633-2.54-.63H1v1.89l4.111-.001c.012.004.778-.015 1.444.359z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var orderAscend = "data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-arrow-two-way-right'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M13.276 6.716a.842.842 0 0 1-1.17 0V4.992H2.464c-.827 0-1.5-.66-1.5-1.472 0-.812.673-1.472 1.5-1.472h9.642V.249a.839.839 0 0 1 1.17 0l2.48 2.708a.799.799 0 0 1 0 1.146l-2.48 2.613zM15.758 10.83l-2.573-2.538a.834.834 0 0 0-1.171 0v1.731H2.583c-.828 0-1.5.664-1.5 1.481 0 .817.672 1.481 1.5 1.481h9.431v1.732a.838.838 0 0 0 1.171 0l2.573-2.538c.322-.318.322-1.031 0-1.349z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var orderRepeat = "data:image/svg+xml,%3Csvg viewBox='0 0 16 17' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-repeat'%3E%3Cpath d='M13.986 4.016H6.939L4.935 2.193a.645.645 0 0 0-.911 0v1.823H1.998a2 2 0 0 0-1.998 2v3.969a2 2 0 0 0 1.998 2h7.238l1.826 1.828a.646.646 0 0 0 .912 0v-1.828h2.012a2 2 0 0 0 1.998-2V6.016a2 2 0 0 0-1.998-2zm-2.924 4.187L9.15 10.031H1.984V5.969h2.04v1.746a.631.631 0 0 0 .911 0l1.879-1.746h7.201l.002 4.062h-2.043V8.203a.632.632 0 0 0-.912 0z' fill='%23434343' class='si-glyph-fill' fill-rule='evenodd'/%3E%3C/svg%3E";
        var soundIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 17 17' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-sound'%3E%3Cpath d='M13.987 14.868c0 .626-.679 1.132-1.516 1.132l-6.514-4.527c-.839 0-1.913-.508-1.913-1.133V5.682c0-.624 1.074-1.132 1.913-1.132L12.471.022c.837 0 1.516.508 1.516 1.133v13.713z' fill='%23434343' class='si-glyph-fill' fill-rule='evenodd'/%3E%3C/svg%3E";
        var mutedIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 17 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-sound-mute'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath class='si-glyph-fill' d='M2.47 13.513l14-11.142.873 1.097-14 11.142zM4.953 9.912V5.01H3.128c-1.283 0-2.115 1.084-2.115 2.46v1.024c0 1.459.769 2.459 2.115 2.459h.386l1.439-1.041zM7.877 12.659l5.059 3.313c.586 0 1.06-.4 1.06-.895V7.919l-6.119 4.74zM13.987.971c0-.507-.499-.92-1.115-.92L7.114 3.73C6.499 3.73 6 4.142 6 4.65v4.189l7.987-6.243V.971z'/%3E%3C/g%3E%3C/svg%3E";
        var prevIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 17 16' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-leftwards-arrow-to-bar'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M5.994 1c0-.553-.442-1-.989-1H3.026a.994.994 0 0 0-.99 1v14c0 .553.443 1 .99 1h1.979a.994.994 0 0 0 .989-1V1zM7.438 9.052a1.49 1.49 0 0 1 0-2.104L13.882.506c.581-.582 2.103-.839 2.103 1v12.988c0 1.901-1.521 1.582-2.103 1.001L7.438 9.052z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var nextIcon = "data:image/svg+xml,%3Csvg viewBox='0 0 16 17' xmlns='http://www.w3.org/2000/svg' class='si-glyph si-glyph-rightwards-arrow-to-bar'%3E%3Cg fill='%23434343' fill-rule='evenodd'%3E%3Cpath d='M11.002 1c0-.553.442-1 .989-1h1.979c.547 0 .989.447.989 1v14c0 .553-.442 1-.989 1h-1.979a.994.994 0 0 1-.989-1V1zM3.113 15.495c-.582.581-2.103.9-2.103-1.001V1.506c0-1.839 1.521-1.582 2.103-1l6.444 6.442a1.49 1.49 0 0 1 0 2.104l-6.444 6.443z' class='si-glyph-fill'/%3E%3C/g%3E%3C/svg%3E";
        var forwardIcon = "";
        var backwardIcon = "";

    }
    {

        mediaStyle = '.button img {height:0.5em;width:0.5em;filter:drop-shadow(0 -3em '+themeColor+');transform:translateY(3em);}\
        .button {display:flex; align-items:center;overflow:hidden;padding:0 0.1em;cursor:pointer;}';
            
            mediaBox.innerHTML = '<style>' + mediaStyle+'</style>' +'<audio></audio>\
            <div class="backdrop" tabIndex="1" style="outline:none;         \
            padding:8px;background:' + backColor + ';">                     \
            <div style="display:flex;align-items:center;                    \
            padding:0 10px;font-size:14px;font-weight:600;">                \
            <div class="timeSlider" style="flex:auto;"></div>               \
            <div class="mediaTime" style="padding-left:10px;                \
            color:' + themeColor + ';">00:00/00:00</div>                    \
            <div class="exitBtn" style="padding-left:10px;cursor:pointer;   \
            color:' + themeColor + ';">Q</div></div>                        \
            <div style="display:flex;align-items:center;padding:0 10px;     \
            font-size:'+ ctrlBtnSize + ';">                                 \
            <div class="orderBtn button"><img src="'+ orderAscend + '"/></div> \
            <div class="prevBtn button"><img src="'+ prevIcon + '"/></div>\
            <div class="playBtn button"><img style="height:1em;width:1em;" src="'+ playIcon + '"/></div>\
            <div class="nextBtn button"><img src="'+ nextIcon + '"/></div> \
            <div class="volBtn button"><img src="'+ soundIcon + '"/></div>\
            <div class="volSlider" style="flex-shrink:0;width:60px;"></div> \
            <div class="mediaName" style="font-size:14px;font-weight:600;   \
            flex:auto;text-align:center;color:'+ themeColor + ';            \
            white-space:nowrap;overflow-y:hidden;overflow-x:auto;"></div>   \
            <div class="fullBtn button" style="margin-left:auto;"><img src="'+ fullIcon + '"/></div>\
            </div></div>';
    }

    // locals =====================================================//
    var isFullScreen = false;
    var oriPlayList = [], playList = [];
    var playPos = 0, playOrder = "Ascend", currentName = "", currentVolume = 1;
    var cTime = 0, minAskTime = 800;

    if (!media) media = mediaBox.querySelector("audio");
    var backdrop = mediaBox.querySelector(".backdrop");
    var orderBtn = backdrop.querySelector(".orderBtn");
    var prevBtn = backdrop.querySelector(".prevBtn");
    var playBtn = backdrop.querySelector(".playBtn");
    var nextBtn = backdrop.querySelector(".nextBtn");
    var volBtn = backdrop.querySelector(".volBtn");
    var fullBtn = backdrop.querySelector(".fullBtn");
    var exitBtn = backdrop.querySelector(".exitBtn");
    var mediaName = backdrop.querySelector(".mediaName");
    var mediaTime = backdrop.querySelector(".mediaTime");
    var timeSlider = new SliderBar(backdrop.querySelector(".timeSlider"), {
        "sliderColor": themeColor, "bufferColor": sliderBufferColor, "progressColor": timeSliderColor
    });
    var volSlider = new SliderBar(backdrop.querySelector(".volSlider"), {
        "sliderColor": themeColor, "bufferColor": sliderBufferColor, "progressColor": volSliderColor
    });

    // using event listener means to co-use with others
    if (!enFullScreen) fullBtn.style.display = "none";
    if (!enMediaName) mediaName.style.display = "none";
    media.addEventListener("ended", function () { playEnd(); });
    media.addEventListener("canplay", function () { mediaName.innerText = currentName; });
    media.addEventListener("loadstart", function () { mediaName.innerText = "Loading " + currentName; });
    media.addEventListener("timeupdate", function () { updateTime(); });
    orderBtn.onclick = function () { playOrderChange(); };
    prevBtn.onclick = function () { playPrev(); };
    playBtn.onclick = function () { playPause(); };
    nextBtn.onclick = function () { playNext(); };
    exitBtn.onclick = function () { playStop(); }
    volBtn.onclick = function () {
        if (media.volume) {
            currentVolume = media.volume;
            media.volume = 0;
            volBtn.querySelector('img').src = mutedIcon;
        } else {
            media.volume = currentVolume;
            volBtn.querySelector('img').src = soundIcon;
        }
        volSlider.updateCurrent(media.volume);
    };
    fullBtn.onclick = function () {
        if (isFullScreen) {
            isFullScreen = false;
            // fullBtn.innerHTML = fullBtnHtml;
            fullBtn.querySelector('img').src = fullIcon;
            exitFullScreen();
        } else {
            isFullScreen = true;
            fullBtn.querySelector('img').src = noFullIcon;
            // fullBtn.innerHTML = noFullBtnHtml;
            enterFullScreen();
        }
    };
    timeSlider.setClickCallBack(function (rate) {
        if (isNaN(media.duration)) return;
        playTime(media.duration * rate);
    });
    volSlider.setClickCallBack(function (rate) {
        media.volume = rate;
        volSlider.updateCurrent(media.volume);
    });
    backdrop.onkeydown = function () { // keyboard showcuts
        switch (event.keyCode || event.which) {
            case 32: event.preventDefault(); playPause(); break; // space
            case 37: event.preventDefault(); playForward(-1 * forwardStep); break; // left Arrow
            case 39: event.preventDefault(); playForward(+1 * forwardStep); break; // right Arrow
            case 38: event.preventDefault(); playPrev(); break; // up Arrow
            case 40: event.preventDefault(); playNext(); break; // down Arrow
        }
    };

    function playThis(link) {
        currentName = decodeURIComponent(link);
        currentName = currentName.slice(currentName.lastIndexOf("/") + 1);
        console.log('play: ', currentName);
        media.src = link;
        media.play();
        // playBtn.innerHTML = pauseBtnHtml;
        playBtn.querySelector('img').src = pauseIcon;
        volSlider.updateCurrent(media.volume);
    }
    function playPause() {
        if (media.src == "") {
            playPos = Math.floor(Math.random() * (playList.length - 1));
            playThis(playList[playPos]);
        } else if (media.paused) {
            media.play();
            // playBtn.innerHTML = pauseBtnHtml;
            playBtn.querySelector('img').src = pauseIcon;
            volSlider.updateCurrent(media.volume);
        } else {
            media.pause();
            // playBtn.innerHTML = playBtnHtml;
            playBtn.querySelector('img').src = playIcon;
            volSlider.updateCurrent(media.volume);
        }
    }
    function playPrev() {
        if (playPos == 0) playPos = playList.length - 1;
        else playPos--;
        playThis(playList[playPos]);
    }
    function playNext() {
        if (playPos == playList.length - 1) playPos = 0;
        else playPos++;
        playThis(playList[playPos]);
    }
    function playEnd() {
        if (playOrder == "Loop") playThis(playList[playPos]);
        else playNext();
    }
    function playStop() {
        try {
            if (isFullScreen) exitFullScreen();
            isFullScreen = false;
            if (media.src != "") {
                media.pause();
                media.currentTime = 0;
            }
            media.src = "";
            timeSlider.updateBuffer(0);
            timeSlider.updateCurrent(0);
            // playBtn.innerHTML = playBtnHtml;
            // fullBtn.innerHTML = fullBtnHtml;
            playBtn.querySelector('img').src = playIcon;
            fullBtn.querySelector('img').src = fullIcon;
            stopCallBack();
        } catch (err) { console.log(err); }
    }
    function playTime(time) {
        if (time >= media.duration) playEnd();
        else {
            media.currentTime = time;
            media.play();
            // playBtn.innerHTML = pauseBtnHtml;
            playBtn.querySelector('img').src = pauseIcon;
            timeSlider.updateCurrent(media.currentTime / media.duration);
            mediaTime.innerText = formatTime(media.currentTime) + ' / ' + formatTime(media.duration);
        }
    }
    function playForward(step) {
        if (isNaN(media.duration)) return;
        playTime(media.currentTime + step);
    }
    function playOrderChange() {
        var currentPlay = playList[playPos];
        switch (playOrder) {
            case "Ascend":
                playOrder = "Random";
                playList.sort(function () { return Math.random() > 0.5 ? -1 : 1; });
                orderBtn.querySelector('img').src = orderRandom;
                break;
            case "Random": 
                playOrder = "Loop"; 
                orderBtn.querySelector('img').src = orderRepeat;
                break;
            case "Loop": 
                playOrder = "Ascend"; 
                playList = oriPlayList; 
                orderBtn.querySelector('img').src = orderAscend;
                break;
            default: 
                playOrder = "Ascend"; 
                playList = oriPlayList;
                orderBtn.querySelector('img').src = orderAscend;
        }
        playPos = playList.indexOf(currentPlay); // could be -1, if wrong
        if (playPos > playList.length || playPos < 0) playPos = 0;
    }
    function enterFullScreen() {
        var de = fullScreenEle;
        var fn = function () { enterFullScreenCallBack(); }
        // promise functions as requestFullscreen
        if (de.requestFullscreen) de.requestFullscreen().then(fn);
        else if (de.mozRequestFullScreen) de.mozRequestFullScreen().then(fn);
        else if (de.webkitRequestFullScreen) de.webkitRequestFullScreen().then(fn);
        else if (de.msRequestFullscreen) de.msRequestFullscreen().then(fn);
    }
    function exitFullScreen() {
        var de = document;
        var fn = function () { exitFullScreenCallBack(); }
        if (de.exitFullscreen) de.exitFullscreen().then(fn);
        else if (de.mozCancelFullScreen) de.mozCancelFullScreen().then(fn);
        else if (de.webkitCancelFullScreen) de.webkitCancelFullScreen().then(fn);
        else if (de.msExitFullscreen) de.msExitFullscreen().then(fn);

    }
    function formatTime(time) {
        if (isNaN(time)) time = 0;
        var minute = String(Math.floor(time / 60));
        var second = String(Math.floor(time % 60));
        if (minute < 10) minute = "0" + minute;
        if (second < 10) second = "0" + second;
        return minute + ':' + second;
    }
    function updateTime() {
        // console.time("upTime");
        function updateTimeCore() {
            if (isNaN(media.duration)) return;
            var timeBuffered = 0;
            var timeText = "00:00 / 00:00";
            try {
                timeBuffered = media.buffered.end(media.buffered.length - 1);
                timeText = formatTime(media.currentTime) + ' / ' + formatTime(media.duration);
            } catch (err) { }
            mediaTime.innerText = timeText;
            timeSlider.updateBuffer(timeBuffered / media.duration);
            timeSlider.updateCurrent(media.currentTime / media.duration);
        }
        var tTime = new Date().getTime();
        if (tTime - cTime > minAskTime) {
            cTime = tTime;
            updateTimeCore();
        }
        // console.timeEnd("upTime");
    }

    // methods ============================================================//
    this.thisPos = function (link) {
        return playList.indexOf(link);
    }
    this.playThis = function (link) {
        var tmpPos = playList.indexOf(link);
        if (tmpPos != -1) playPos = tmpPos;
        playThis(link);
    }
    this.playStop = playStop;
    this.fullScreen = function () { fullBtn.click(); }
    this.setPlayList = function (newPlayList) {
        oriPlayList = newPlayList;
        playList = oriPlayList.slice(0); // to copy but not get memory address
        playOrder = "Ascend";
        playPos = 0;
    }
}


