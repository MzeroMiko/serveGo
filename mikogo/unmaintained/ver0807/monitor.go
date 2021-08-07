package main

// import  "parts.go"
import (
	"io/ioutil"
	"os/exec"
	"time"
	// "fmt"
)

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
