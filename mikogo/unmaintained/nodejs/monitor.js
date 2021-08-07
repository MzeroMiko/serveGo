/*
 * use fs, exec, (except for those as parameters)
 * written by Mzero for MikoSite, MIT License
 * return system info = {cpuInfo, memInfo, diskInfo, process, network, uptime, distro, host, version}  
 */

var fs = require('fs');
var exec = require('child_process').exec;

module.exports = function monitor() {

    // local vars ==============================================//
    var cpuInfo = {
        "Name": "", "Core": "", "Loadavg": "",
        "Temperature": "", "Flags": "", "Idle": "", "Total": "", "Idles": "", "Totals": ""
    };
    var memInfo = {
        "MemTotal": "", "MemFree": "", "Cached": "", "Buffers": "",
        "SwapTotal": "", "SwapFree": "", "SwapCached": ""
    };
    var diskInfo = { "Usage": "", "Detail": "" };
    var process = { "General": "", "Detail": "" };
    var network = []; // { "Dev":"","Ipv4":"","Ipv6":"","RxBytes":"","TxBytes":"" }
    var uptime = "", distro = "", host = "", version = "";

    // actions ==================================================//
    getCpu(); getMem(); getDisk(); getNet();
    getUptime(); getDistro(); getHost(); getVersion();

    // local functions =========================================//
    function timeHuman(time) {
        var result = "";
        var time_s = Math.floor(time + 0.5);
        var time_m = Math.floor(time_s / 60);
        var time_h = Math.floor(time_m / 60);
        var time_d = Math.floor(time_h / 24);
        time_s = time_s - time_m * 60;
        time_m = time_m - time_h * 60;
        time_h = time_h - time_d * 24;
        result += time_d.toString() + 'd ' + time_h.toString() + 'h ';
        result += time_m.toString() + 'm ' + time_s.toString() + 's ';
        return result;
    }

    function getCpu() {
        fs.readFile("/sys/class/thermal/thermal_zone0/temp", function (err, data) {
            if (!err) cpuInfo.Temperature = String(Number(data.toString()) / 1000);
        });
        fs.readFile("/proc/loadavg", function (err, data) {
            var load = data.toString().trim().split(" ");
            cpuInfo.Loadavg = load[0] + " " + load[1] + " " + load[2];
        });
        fs.readFile("/proc/cpuinfo", function (err, data) {
            if (!err) {
                var info = data.toString().split('\n');
                var cpuName = ""; var cpuCore = 0; var cpuFlags = "";
                for (var i in info) {
                    var item = info[i];
                    if (item.indexOf("model name") == 0) {
                        var tmp = item.slice(item.indexOf(":") + 1).trim();
                        cpuCore++;
                        if (cpuName.indexOf(tmp) == -1) {
                            if (cpuName != "") {
                                cpuName += " | ";
                            }
                            cpuName += tmp;
                        }
                    }
                }
                cpuInfo.Name = cpuName;
                cpuInfo.Core = cpuCore.toString();
            }
        });
        fs.readFile("/proc/stat", function (err, data) {
            if (!err) {
                var tmpIdles = [], tmpTotals = [];
                var info = data.toString().split('\n');
                info = info.filter(function (s) { return s && s.trim(); });
                for (var i = 0; i < info.length; i++) {
                    if (info[i].indexOf('cpu') == -1) break;
                    // cpu, cpu0, cpu1, ...
                    var tmp = info[i].slice(info[i].indexOf(" "));
                    tmpInfo = tmp.trim().split(' ');
                    tmpIdles.push(Number(tmpInfo[3]));
                    var tmpTotal = 0;
                    for (var j = 0; j < tmpInfo.length; j++)
                        tmpTotal = tmpTotal + Number(tmpInfo[j]);
                    tmpTotals.push(tmpTotal);
                }
                cpuInfo.Idles = JSON.stringify(tmpIdles);
                cpuInfo.Totals = JSON.stringify(tmpTotals);
            }
        });
    }

    function getMem() {
        fs.readFile("/proc/meminfo", function (err, data) {
            if (!err) {
                var info = data.toString().split('\n');
                for (var i = 0; i < info.length; i++) {
                    var tmpInfo = info[i];
                    if (tmpInfo.indexOf("MemTotal") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.MemTotal = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("MemFree") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.MemFree = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("Cached") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.Cached = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("Buffers") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.Buffers = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("SwapTotal") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.SwapTotal = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("SwapFree") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.SwapFree = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                    if (tmpInfo.indexOf("SwapCached") == 0) {
                        var tmp = tmpInfo.slice(tmpInfo.indexOf(":") + 1).trim();
                        memInfo.SwapCached = tmp.slice(0, tmp.indexOf(" ")).trim();
                    }
                }
            }
        });
    }

    function getDisk() {
        exec("df -h 2>&1", function (err, stdout, stderr) {
            if (!err) {
                diskInfo.Detail = stdout;
                var info = stdout.split('\n').filter(function (s) { return s && s.trim(); });
                for (var i in info) {
                    var tmp = info[i].trim();
                    if (tmp.length != 0 && tmp.lastIndexOf("/") + 1 == tmp.length) {
                        tmp = tmp.slice(0, tmp.lastIndexOf("%"));
                        diskInfo.Usage = tmp.slice(tmp.lastIndexOf(" "));
                        break;
                    }
                }
            }
        });
    }

    // wasted
    function getProcOri() {
        exec("ps -aux 2>&1", function (err, stdout, stderr) {
            if (!err) {
                process.Detail = stdout;
                var info = stdout.split('\n');
                var totalProc = 0;
                var users = []; var nums = [];
                for (var i = 1; i < info.length; i++) {
                    var user = info[i].trim();
                    user = user.slice(0, user.indexOf(' '));
                    if (user == "") {
                        continue
                    }
                    totalProc++;
                    var j = 0;
                    for (j = 0; j < users.length; j++) {
                        if (users[j] == user) {
                            nums[j]++;
                            break;
                        }
                    }
                    if (j == users.length) {
                        users.push(user);
                        nums.push(1);
                    }
                }
                var generalProc = "Total: " + totalProc.toString();
                for (var i = 0; i < users.length; i++) {
                    generalProc += " | " + users[i] + ": " + nums[i].toString();
                }
                process.General = generalProc;
            }
        });
    }

    // wasted 
    function getNetOri() {
        exec("ifconfig 2>&1", function (err, stdout, stderr) {
            if (!err) {
                network = [];
                var info = stdout.split('\n\n');
                for (var i in info) { // devices
                    var infoNet = {
                        "Dev": "", "Ipv4": "", "Ipv6": "", "RxBytes": "", "TxBytes": ""
                    }
                    infoNet.Dev = info[i].slice(0, info[i].indexOf(":"));
                    if (infoNet.Dev == "lo" || info[i] == "") continue;
                    var subInfo = info[i].split('\n');
                    for (var j in subInfo) {
                        var tmpInfo = subInfo[j];
                        if (tmpInfo.indexOf('inet ') != -1) {
                            var tmp = tmpInfo.slice(tmpInfo.indexOf("inet ") + 5).trim();
                            infoNet.Ipv4 = tmp.slice(0, tmp.indexOf(" ")).trim();
                        }
                        if (tmpInfo.indexOf('inet6 ') != -1) {
                            var tmp = tmpInfo.slice(tmpInfo.indexOf("inet6 ") + 6).trim();
                            infoNet.Ipv6 = tmp.slice(0, tmp.indexOf(" ")).trim();
                        }
                        if (tmpInfo.indexOf('RX packets ') != -1) {
                            var tmp = tmpInfo.slice(tmpInfo.indexOf("bytes ") + 6).trim();
                            infoNet.RxBytes = tmp.slice(0, tmp.indexOf(" ")).trim();
                        }
                        if (tmpInfo.indexOf('TX packets ') != -1) {
                            var tmp = tmpInfo.slice(tmpInfo.indexOf("bytes ") + 6).trim();
                            infoNet.TxBytes = tmp.slice(0, tmp.indexOf(" ")).trim();
                        }
                    }
                    network.push(infoNet);
                }
            }
        });
        // version 2
        fs.readFile("/proc/net/route", function (err, data) {
            if (!err) {
                var route = data.toString().split('\n').slice(1);
                var routeLength = route.length;
                for (var i = 0; i < routeLength; i++) {
                    var r4 = route[i].trim();
                    if (r4 != "") {
                        var r4Arr = r4.split("\t").filter(function (item) { return item.trim() != "" });
                        var ipv4Addr = "";
                        for (var j = 0; j < 4; j++) {
                            ipv4Addr = "." + parseInt(r4Arr[1].slice(2 * j, 2 * j + 2), 16).toString() + ipv4Addr;
                        }
                        for (var j = 0; j < network.length; j++) {
                            if (network[j].Dev == r4Arr[0]) network[j].Ipv4 += ipv4Addr.slice(1) + " | ";
                        }
                    }
                }
            }
        });
        fs.readFile("/proc/net/if_inet6", function (err, data) {
            if (!err) {
                var route6 = data.toString().split('\n');
                var route6Length = route6.length;
                for (var i = 0; i < route6Length; i++) {
                    var r6 = route6[i].trim();
                    if (r6 != "") {
                        var r6Arr = r6.split(" ").filter(function (item) { return item.trim() != "" });
                        var ipv6Addr = "";
                        for (var j = 0; j < 8; j++) {
                            ipv6Addr += ":" + r6Arr[0].slice(j * 4, j * 4 + 4);
                        }
                        for (var j = 0; j < network.length; j++) {
                            if (network[j].Dev == r6Arr[r6Arr.length - 1]) network[j].Ipv6 += ipv6Addr.slice(1) + " | ";
                        }
                    }
                }
            }
        });
    }

    function getNet() {
        fs.readFile("/proc/net/dev", function (err, data) {
            if (!err) {
                network = [];
                var dev = data.toString().split('\n').slice(2);
                var devLength = dev.length;
                for (var i = 0; i < devLength; i++) {
                    var d = dev[i].trim();
                    if (d != "") {
                        dArr = d.split(" ").filter(function (item) { return item.trim() != "" });
                        var tmp = { "Dev": "", "RxBytes": "", "TxBytes": "" };
                        tmp.Dev = dArr[0].slice(0, -1); tmp.RxBytes = dArr[1]; tmp.TxBytes = dArr[9];
                        network.push(tmp);
                    }
                }
            }
        });
    }

    function getUptime() {
        fs.readFile("/proc/uptime", function (err, data) {
            if (!err) {
                var info = data.toString().split(' ').filter(function (s) { return s && s.trim(); });
                uptime = timeHuman(Number(info[0]));
            }
        });
    }

    function getDistro() {
        fs.readFile("/etc/issue", function (err, data) {
            if (!err) {
                distro = data.toString();
                distro = distro.slice(0, distro.indexOf("\\"));
            }
        });
    }

    function getHost() {
        fs.readFile("/etc/hostname", function (err, data) {
            if (!err) { host = data.toString(); }
        });
    }

    function getVersion() {
        fs.readFile("/proc/version", function (err, data) {
            if (!err) { version = data.toString(); }
        });
    }

    // Methods ======================================================//
    var cTime = 0, minAskTime = 3000;
    this.getInfo = function () {
        // if ask twice in 3 seconds, return same value 
        var tTime = new Date().getTime();
        if (tTime - cTime > minAskTime) {
            cTime = tTime;
            getUptime(); getDistro(); getHost(); getVersion();
            getCpu(); getMem(); getDisk(); getNet();
        }
        return JSON.stringify({
            "CpuInfo": JSON.stringify(cpuInfo),
            "MemInfo": JSON.stringify(memInfo),
            "DiskInfo": JSON.stringify(diskInfo),
            "Process": JSON.stringify(process),
            "Network": JSON.stringify(network),
            "Uptime": uptime,
            "Distro": distro,
            "Host": host,
            "Version": version
        });
    }
}
