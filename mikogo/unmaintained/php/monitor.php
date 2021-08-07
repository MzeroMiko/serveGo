<?php
class monitor
{
    // local vars ==============================================//
    private $cpuInfo = array(
        "Name" => "", "Core" => 0, "Loadavg" => "",
        "Temperature" => "", "Flags" => "", "Idle" => 0, "Total" => 0
    );
    private $memInfo = array(
        "MemTotal" => "", "MemFree" => "", "Cached" => "", "Buffers" => "",
        "SwapTotal" => "", "SwapFree" => "", "SwapCached" => ""
    );
    private $diskInfo = array("Usage" => "", "Detail" => "");
    private $process = array("General" => "", "Detail" => "");
    private $network = array(); // {"Dev","Ipv4","Ipv6", "RxBytes","TxBytes"}
    private $uptime = "", $distro = "", $host = "", $version = "";

    private function getCpu()
    {
        $info = @file_get_contents("/sys/class/thermal/thermal_zone0/temp");
        $this->cpuInfo["Temperature"] = strval(intval($info) / 1000);
        // ------------------------------------------------------------//
        $info = @file_get_contents("/proc/loadavg");
        $info = array_merge(array_filter(explode(" ", $info)));
        $info = $info[0] . " " . $info[1] . " " . $info[2];
        $this->cpuInfo["Loadavg"] = $info;
        // -----------------------------------------------------------//
        $fp = @fopen("/proc/cpuinfo", "r");
        $cpuName = "";
        $cpuCore = 0;
        $cpuFlags = "";
        while (!feof($fp)) {
            $info = fgets($fp);
            if (strstr($info, "model name")) {
                $tmp = trim(substr($info, strpos($info, ":") + 1));
                $cpuCore++;
                if (!strstr($cpuName, $tmp)) {
                    if ($cpuName != "") {
                        $cpuName .= " | ";
                    }
                    $cpuName .= $tmp;
                }
            }
            if ($cpuFlags == "" && strstr($info, "flags")) {
                $cpuFlags = trim(substr($info, strpos($info, ":") + 1));
            }
        }
        $this->cpuInfo["Name"] = $cpuName;
        $this->cpuInfo["Core"] = $cpuCore;
        $this->cpuInfo["Flags"] = $cpuFlags;
        // ---------------------------------------------------------//
        $fp = @fopen("/proc/stat", "r");
        $info = fgets($fp);
        $info = array_filter(explode(" ", $info), function ($var) {
            return ($var != "");
        });
        $info = array_merge($info);
        $tmpTotal = 0;
        $this->cpuInfo["Idle"] = intval($info[4]);
        for ($i = 1; $i < count($info); $i++) $tmpTotal += intval($info[$i]);
        $this->cpuInfo["Total"] = $tmpTotal;
    }

    private function getMem()
    {
        $fp = @fopen("/proc/meminfo", "r");
        while (!feof($fp)) {
            $info = fgets($fp);
            if (strpos($info, "MemTotal") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["MemTotal"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "MemFree") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["MemFree"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "Cached") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["Cached"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "Buffers") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["Buffers"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "SwapTotal") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["SwapTotal"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "SwapFree") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["SwapFree"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strpos($info, "SwapCached") === 0) {
                $info = trim(strstr($info, " "));
                $this->memInfo["SwapCached"] = trim(substr($info, 0, strpos($info, " ")));
            }
        }
    }

    private function getDisk()
    {
        $fp = popen("df -h 2>&1", "r");
        $stdout = '';
        while (!feof($fp)) {
            $info = fgets($fp);
            $stdout = $stdout . $info;
            $tmp = trim($info);
            if (strlen($tmp) != 0 && strrpos($tmp, "/") + 1 == strlen($tmp)) {
                $tmp = substr($tmp, 0, strrpos($tmp, "%"));
                $this->diskInfo["Usage"] = substr($tmp, strrpos($tmp, " ") + 1);
            }
        }
        $this->diskInfo["Detail"] = $stdout;
    }

    private function getProc()
    {
        $fp = popen("ps -aux 2>&1", "r");
        $stdout = '';
        $totalProc = 0;
        $users = array();
        $nums = array();
        $stdout = fgets($fp); // headline
        while (!feof($fp)) {
            $info = fgets($fp);
            $stdout = $stdout . $info;
            $user = trim($info);
            $user = substr($user, 0, strpos($user, " "));
            if ($user == "") {
                continue;
            }
            $totalProc++;
            $j = 0;
            for ($j = 0; $j < count($users); $j++) {
                if ($users[$j] == $user) {
                    $nums[$j]++;
                    break;
                }
            }
            if ($j == count($users)) {
                array_push($users, $user);
                array_push($nums, 1);
            }
        }
        $generalProc = 'Total: ' . $totalProc;
        for ($i = 0; $i < count($users); $i++)
            $generalProc .= " | " . $users[$i] . ': ' . $nums[$i];
        $this->process["General"] = $generalProc;
        $this->process["Detail"] = $stdout;
    }

    private function getNet()
    {
        $network = array();
        $fp = @popen("ifconfig 2>&1", "r");
        $infoNet = array(
            "Dev" => "", "Ipv4" => "", "Ipv6" => "", "RxBytes" => "", "TxBytes" => ""
        );
        while (!feof($fp)) {
            $info = fgets($fp);
            if (strcmp($info, "\n") == 0 && strcmp($infoNet["Dev"], "lo") != 0) {
                array_push($network, $infoNet);
            }
            if (strstr($info, "flags")) {
                $infoNet["Dev"] = substr($info, 0, strpos($info, ":"));
            }
            if (strstr($info, "inet ")) {
                $info = trim(substr($info, strpos($info, "inet ") + 5));
                $infoNet["Ipv4"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strstr($info, "inet6 ")) {
                $info = trim(substr($info, strpos($info, "inet6 ") + 6));
                $infoNet["Ipv6"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strstr($info, "RX packets ")) {
                $info = trim(substr($info, strpos($info, "bytes ") + 6));
                $infoNet["RxBytes"] = trim(substr($info, 0, strpos($info, " ")));
            }
            if (strstr($info, "TX packets ")) {
                $info = trim(substr($info, strpos($info, "bytes ") + 6));
                $infoNet["TxBytes"] = trim(substr($info, 0, strpos($info, " ")));
            }
        }
        $this->network = $network;
    }

    private function getUptime()
    {
        function timeHuman($time)
        {
            $result = "";
            $time_s = round($time);
            $time_m = floor($time_s / 60);
            $time_h = floor($time_m / 60);
            $time_d = floor($time_h / 24);
            $time_s = $time_s - $time_m * 60;
            $time_m = $time_m - $time_h * 60;
            $time_h = $time_h - $time_d * 24;
            $result .= strval($time_d) . 'd ' . strval($time_h) . 'h ';
            $result .= strval($time_m) . 'm ' . strval($time_s) . 's ';
            return $result;
        }
        $this->uptime = trim(@file_get_contents("/proc/uptime"));
        $this->uptime = substr($this->uptime, 0, strpos($this->uptime, " "));
        $this->uptime = timeHuman(intval($this->uptime));
    }

    private function getDistro()
    {
        $this->distro = @file_get_contents("/etc/issue");
        $this->distro = substr($this->distro, 0, strpos($this->distro, "\\"));
    }

    private function getHost()
    {
        $this->host = @file_get_contents("/etc/hostname");
    }

    private function getVersion()
    {
        $this->version = @file_get_contents("/proc/version");
    }

    private $cTime = 0, $minAskTime = 3000;
    public function getInfo()
    {
        // if ask twice in 3 seconds, return same value 
        $tTime = time();
        if ($tTime - $this->cTime > $this->minAskTime) {
            $this->cTime = $tTime;
            $this->getCpu();
            $this->getMem();
            $this->getDisk();
            $this->getProc();
            $this->getNet();
            $this->getUptime();
            $this->getDistro();
            $this->getHost();
            $this->getVersion();
        }
        return json_encode(array(
            "CpuInfo" => json_encode($this->cpuInfo),
            "MemInfo" => json_encode($this->memInfo),
            "DiskInfo" => json_encode($this->diskInfo),
            "Process" => json_encode($this->process),
            "Network" => json_encode($this->network),
            "Uptime" => $this->uptime,
            "Distro" => $this->distro,
            "Host" => $this->host,
            "Version" => $this->version
        ));
    }
}
