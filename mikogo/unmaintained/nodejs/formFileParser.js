/*
 * use fs, http(Request, Response), (except for those as parameters)
 * written by Mzero for MikoSite, MIT License
 * parseFormData and store file into writestream, can proc even ~GB(per file) files  
 * example: 
 * new (require("./formFileParser"))({ uploadDir: __dirname + "/test" })
 * .parse(request, function (err, files){});
 */

var fs = require("fs");

function BufferStream() {
    // a simulation for fs.createWriteStream()
    var buffer = Buffer.from([]);
    this.write = function (buf) {
        buffer = Buffer.concat([buffer, buf]);
    }
    this.end = function (buf) {
        if (typeof buf != "undefined")
            buffer = Buffer.concat([buffer, buf]);
        return Buffer.from(buffer);
    }
}

module.exports = function formFileParser(opts) {
    // parse parameters ============================//
    if (typeof opts == "undefined") opts = {};
    var uploadDir = ("uploadDir" in opts) ? opts.uploadDir : "";
    var memMode = ("memMode" in opts) ? opts.memMode : (uploadDir == ""); // store in memory as a buffer
    var bufSize = ("bufSize" in opts) ? opts.bufSize : 4096; // bufSize for tmpData
    var maxMemSize = ("maxMemSize" in opts) ? opts.maxMemSize : 5*1024*1024;
    if (!memMode) { // check uploadDir
        if (uploadDir == "") {
            console.log("no uploadDir found");
            return;
        }
        if (fs.existsSync(uploadDir)) {
            if (!fs.statSync(uploadDir).isDirectory()) {
                console.log(uploadDir, "is not a directory");
                return;
            }
        } else {
            try { fs.mkdirSync(uploadDir, { recursive: true }); } 
            catch (err) {
                console.log("mkdir:", uploadDir, "error");
                return;
            }
        }
    }

    // state for parse form FSM 
    var stateSearchBoundary = 0;
    var stateSearchFileInfo = 1;
    var stateSearchFileEnd = 2;

    // methods ===================================//
    // callback(err, files[])
    // formData: BOUNDARY\r\nINFO\r\n\r\nCONTENT\r\nBOUNDARY\r\n...BOUNDARY--\r\n
    this.parse = function (request, callback) {
        var cType = request.headers['content-type'];
        if (typeof cType == "undefined") {
            callback("Error: content-type can not be found in headers", []);
            return;
        } else {
            var boundaryPos = cType.lastIndexOf("boundary=");
            if (boundaryPos == -1) {
                callback("Error: boundary can not be found in headers", []);
                return;
            }
        }

        var bufferList = []; // bufferList[i] = buffer;
        var bufferStream = null;
        var writeStream = null;
        // data is tmp array(max length is bufSize) storing tmp request body data
        var boundaryBuf = Buffer.from("--" + cType.slice(boundaryPos + 9));
        var state = stateSearchBoundary;
        var data = [], info = [], tmpFiles = [], subInfoArr = [];
        request.on('data', function (chunck) {
            // use chunk, boundaryBuf, subInfoArr, state
            function searchBoundary(pos) {
                if (!Buffer.from(chunck.slice(pos, pos + boundaryBuf.length)).compare(boundaryBuf)) {
                    subInfoArr = [];
                    state = stateSearchFileInfo;
                    return pos + boundaryBuf.length + 2;
                } else {
                    return pos + 1;
                }
            }
            // use chunk, info, data, subInfoArr, state
            function searchFileInfo(pos) {
                if (chunck[pos] == 13 && chunck[pos + 1] == 10 &&
                    chunck[pos + 2] == 13 && chunck[pos + 3] == 10) {
                    // find \r\n\r\n
                    info.push(Buffer.from(subInfoArr).toString());
                    data.length = 0;
                    var tmpFileName = new Date().getTime();
                    tmpFiles.push(tmpFileName);
                    if (memMode) bufferStream = new BufferStream();
                    else writeStream = fs.createWriteStream(uploadDir + "/" + tmpFileName);
                    state = stateSearchFileEnd;
                    return pos + 4;
                } else {
                    subInfoArr.push(chunck[pos]);
                    return pos + 1;
                }
            }
            // use chunk, writeStream, boundaryBuf, data, subInfoArr, state
            function searchFileEnd(pos) {
                if (chunck[pos] == 13 && chunck[pos + 1] == 10 && chunck[pos + 2] == 45 &&
                    !Buffer.from(chunck.slice(pos + 2, pos + boundaryBuf.length + 2)).compare(boundaryBuf)) {
                    // find boundary, use and to escape unnecessary of produce!!!!!!!!!!!
                    pos += boundaryBuf.length + 2; // \r\nboundary
                    if (memMode) {
                        bufferStream.write(Buffer.from(data));
                        bufferList.push(bufferStream.end());
                    } else {
                        writeStream.write(Buffer.from(data));
                        writeStream.end();
                    }
                    if (chunck[pos] == 45 && chunck[pos + 1] == 45) { // find "--", end "--\r\n"
                        state = stateSearchBoundary;
                        return pos + 4;
                    } else {  // not end, "\r\n"
                        subInfoArr = [];
                        state = stateSearchFileInfo;
                        return pos + 2;
                    }
                } else {
                    if (data.length > bufSize) {
                        if (memMode) bufferStream.write(Buffer.from(data));
                        else writeStream.write(Buffer.from(data));
                        data.length = 0;
                    }
                    data.push(chunck[pos]);
                    return pos + 1;
                }
            }
            // use chunk, writeStream, info, data, subInfoArr, state
            function reset() {
                bufferStream = null, writeStream = null, data = [], info = [], subInfoArr = [];
                state = stateSearchBoundary;
                return chunck.length;
            }

            var pos = 0;
            while (pos < chunck.length) {
                switch (state) {
                    case stateSearchBoundary: pos = searchBoundary(pos); break;
                    case stateSearchFileInfo: pos = searchFileInfo(pos); break;
                    case stateSearchFileEnd: pos = searchFileEnd(pos); break;
                    default: pos = reset(); callback("Error: parse error", []);
                }
            }

        });
        request.on('end', function () {
            var files = [];
            if (info.length != tmpFiles.length) {
                callback("Error: data broken.", []);
                return;
            } else for (var i in tmpFiles) {
                var namePos = info[i].indexOf("name=");
                var filenamePos = info[i].indexOf("filename=");
                var contentTypePos = info[i].indexOf("Content-Type:");

                var name = (namePos != -1) ? info[i].slice(namePos + 6, filenamePos - 3) : "";
                var contentType = (contentTypePos != -1) ? info[i].slice(contentTypePos + 14) : "";
                var filename = (filenamePos != -1) ?
                    info[i].slice(filenamePos + 10, info[i].lastIndexOf("\r") - 1) : "";
                if (memMode) files.push({
                    "Content-Type": contentType,
                    "name": name, "filename": filename, "buffer": bufferList[i]
                });
                else files.push({
                    "Content-Type": contentType,
                    "name": name, "filename": filename, "tmpFileName": tmpFiles[i]
                });
            }
            callback("", files);
        });
        request.on('error', function (err) {
            callback("Error: request error," + err.message, []);
        });
    }
}