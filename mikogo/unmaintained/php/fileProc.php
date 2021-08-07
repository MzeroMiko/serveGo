<?php
class fileProc
{
    // settings =====================================//
    private $indexList = array("index.html", "index.htm", "index.php");
    private $sessionTime = 10;
    private $authKey = "123";
    private $trashDir = ".trash";
    private $homePage = "./home.html";
    private $authFail = "authFail";
    private $authPass = "authPass";
    private $signFail = "fail";
    private $signWarn = "warn";
    private $signPass = "pass";
    private $mimeSet = array(
        "unknown" => "",
        "css" => "text/css", "gif" => "image/gif", "html" => "text/html",
        "php" => "text/html", "ico" => "image/x-icon", "jpeg" => "image/jpeg",
        "jpg" => "image/jpeg", "js" => "text/javascript", "json" => "application/json",
        "pdf" => "application/pdf", "png" => "image/png", "svg" => "image/svg+xml",
        "swf" => "application/x-shockwave-flash", "tiff" => "image/tiff", "txt" => "text/plain",
        "wav" => "audio/x-wav", "wma" => "audio/x-ms-wma", "wmv" => "video/x-ms-wmv",
        "xml" => "text/xml", "mp3" => "audio/mpeg", "mp4" => "video/mp4",
    );

    public function __construct($opts)
    {
        session_id(md5("sessionID"));
        session_start(); // for checkToken
        if (!isset($opts)) {
            $opts = array();
        }
        if (key_exists("indexList", $opts)) {
            $this->indexList = $opts["indexList"];
        }
        if (key_exists("sessionTime", $opts)) {
            $this->sessionTime = $opts["sessionTime"];
        }
        if (key_exists("authKey", $opts)) {
            $this->authKey = $opts["authKey"];
        }
        if (key_exists("trashDir", $opts)) {
            $this->trashDir = $opts["trashDir"];
        }
        if (key_exists("homePage", $opts)) {
            $this->homePage = $opts["homePage"];
        }
        if (key_exists("authFail", $opts)) {
            $this->authFail = $opts["authFail"];
        }
        if (key_exists("authPass", $opts)) {
            $this->authPass = $opts["authPass"];
        }
        if (key_exists("signFail", $opts)) {
            $this->signFail = $opts["signFail"];
        }
        if (key_exists("signPass", $opts)) {
            $this->signPass = $opts["signPass"];
        }
        if (key_exists("signWarn", $opts)) {
            $this->signWarn = $opts["signWarn"];
        }
        if (key_exists("mimeSet", $opts)) {
            $this->mimeSet = $opts["mimeSet"];
        }
    }

    // file Server ============================================//
    public function chooseType($realPath)
    {
        $suffix = ltrim(strrchr($realPath, "."), ".");
        if (array_key_exists($suffix, $this->mimeSet)) {
            return $this->mimeSet[$suffix];
        } else {
            return $this->mimeSet["unknown"];
        }
    }

    public function parseRange($rangeStr, $filesize)
    {
        // https://blog.csdn.net/thewindkee/article/details/80189434
        // Examples: 1.Range: bytes=1-499 (1-499 Bytes) 2.Range: bytes=-500 (last 500 Bytes)
        // 3. Range: bytes=500- (500-end Bytes) 4.Range: bytes=500-600,601-999
        // Res: Content-Range: bytes (unit first byte pos) - [last byte pos]/[entity length]
        // Examples: Content-Range: bytes 1-499/22400

        $results = array();
        $start = 0;
        $end = 0;
        if (strpos($rangeStr, "=") === false || $filesize <= 0) {
            return $results;
        }
        $rangeStr = substr($rangeStr, strpos($rangeStr, "=") + 1);
        $rangeList = explode(",", $rangeStr);
        // var start int64; var stop int64; var err error;
        foreach ($rangeList as $range) {
            $rangeStr = trim($range);
            if (strpos($rangeStr, "-") === false) {
                return $results;
            } // not a correct rangeStr
            $rangeArr = explode("-", $rangeStr);
            // error_log($rangeStr . '+' . $rangeArr[0] . '+' . $rangeArr[1]);
            if ($rangeArr[0] == "" && $rangeArr[1] == "") {
                $start = 0;
                $end = $filesize - 1;
            } elseif ($rangeArr[0] == "" && $rangeArr[1] != "") {
                $start = $filesize - intval($rangeArr[1]);
                $end = $filesize - 1;
            } elseif ($rangeArr[0] != "" && $rangeArr[1] == "") {
                $start = intval($rangeArr[0]);
                $end = $filesize - 1;
            } elseif ($rangeArr[0] != "" && $rangeArr[1] != "") {
                $start = intval($rangeArr[0]);
                $end = intval($rangeArr[1]);
            }
            array_push($results, array("start" => $start, "end" => $end));
        }
        return $results;
    }

    public function sendFile($octet, $realPath)
    {
        // console.log(Request.headers); // Request headers: lower litter char!
        $start = 0;
        $end = 0;
        if (is_dir($realPath)) {
            if ($octet) {
                header("HTTP/1.1 404 Not Found");
                echo "";
            }
            return "Error: is Directory";
        }
        $fp = fopen($realPath, 'rb');
        if ($fp == null) {
            if ($octet) {
                header("HTTP/1.1 404 Not Found");
                echo "";
            }
            return "Error: open file error";
        }

        $fileName = substr($realPath, strrpos($realPath, "/") + 1);
        $fileSize = filesize($realPath);
        $LastModified = date('D, d M Y H:i:s', filemtime($realPath)) . ' GMT';
        $Etag = "W/\"" . strval($fileSize) . "-" . strval(filemtime($realPath)) . "\"";
        $contentType = $this->chooseType($realPath);
        $contentDisposition = "filename=\"" . rawurlencode($fileName) . "\"; filename*=utf-8''" . rawurlencode($fileName);
        if ($octet) {
            $contentDisposition = "attachment;" . $contentDisposition;
        }

        $modifiedSince = array_key_exists("HTTP_IF_MODIFIED_SINCE", $_SERVER);
        $modifiedSince = $modifiedSince && $_SERVER["HTTP_IF_MODIFIED_SINCE"] == $LastModified;
        $noneMatch = array_key_exists("HTTP_IF_NONE_MATCH", $_SERVER);
        $noneMatch = $noneMatch && $_SERVER["HTTP_IF_NONE_MATCH"] == $Etag;
        if ($modifiedSince || $noneMatch) {
            header("HTTP/1.1 304 Found");
            return "";
        }

        header("Accpet-Ranges: bytes");
        header("Cache-Control: public, max-age=0");
        header("Last-Modified: " . $LastModified);
        header("Etag: " . $Etag);
        header("Content-Disposition: " . $contentDisposition);
        if ($contentType != "") {
            header("Content-type: " . $contentType);
        } else {
            header("Content-type: application/octet-stream");
        }

        if (!isset($_SERVER["HTTP_RANGE"])) {
            $start = 0;
            $end = $fileSize;
            header("Content-Length: " . strval($fileSize));
            header("HTTP/1.1 200 OK");
        } else {
            $ranges = $this->parseRange($_SERVER["HTTP_RANGE"], $fileSize);
            if (count($ranges) == 0) { // has no range
                header('HTTP/1.1 416 Requested Range Not Satisfiable');
                return "";
            }
            // only trans the first
            $start = $ranges[0]["start"];
            $end = $ranges[0]["end"];
            header("Content-Length: " . strval($end - $start + 1));
            header("Content-Range: bytes " . strval($start) . "-" . strval($end) . "/" . strval($fileSize));
            header('HTTP/1.1 206 Partial Content');
        }
        fseek($fp, $start);
        while (!feof($fp)) {
            echo fread($fp, round(4096, 0));
            ob_flush();
        }
        if ($fp != null) {
            fclose($fp);
        }
        return "";
    }

    public function scanIndex($realPath)
    {
        if (substr($realPath, -1) == "/") {
            $realPath = substr($realPath, 0, -1);
        }
        $pageRank = -1;
        $webPage = "";
        $name = "";
        $dh = opendir($realPath);
        while (($name = readdir($dh)) !== false) {
            $rank = array_search($name, $this->indexList);
            if ($rank !== false && ($pageRank == -1 || $rank < $pageRank)) {
                $pageRank = $rank;
                $webPage = "./" . rawurlencode($name);
            }
        }
        return $webPage;
    }

    public function sendMessage($statusCode, $errInfo)
    {
        header("HTTP/1.1 " . strval($statusCode));
        header("Content-Type: text/html; charset=utf-8;");
        $htmlStr = "<div style=\"padding:48px;\">" . "<div style=\"font-weight:600;font-size:36px;word-break:break-word;\">" . $errInfo . "</div></div>";
        echo $htmlStr;
    }

    public function reDirect($statusCode, $target)
    {
        header("Location: " . $target);
        header("HTTP/1.1 " . strval($statusCode) . " Found");
    }

    public function sendStatic($ignorePage, $realPath)
    {
        $err = $this->sendFile(false, $realPath);
        if ($err == "Error: is Directory") {
            if ($ignorePage) {
                $err = $this->sendFile(false, $this->homePage);
                if ($err != "") {
                    $this->sendMessage(200, $err);
                }
                return;
            }
            $webPage = $this->scanIndex($realPath);
            if ($webPage == "") {
                $err = $this->sendFile(false, $this->homePage);
                if ($err != "") {
                    $this->sendMessage(200, $err);
                }
            } else {
                $this->reDirect(302, $webPage);
            }
        } elseif ($err != "") {
            $this->sendMessage(404, $err);
        }
    }
    // read Dir ==============================================//
    // type dirInfo struct { FileList, FolderList, Err string}
    // type dirList struct { Name, Time, Size string}
    public function readDirSync($realPath)
    {
        if (substr($realPath, -1) == "/") {
            $realPath = substr($realPath, 0, -1);
        }
        $info = array(
            "Err" => "", "FileList" => "", "FolderList" => ""
        );
        $folderList = array();
        $fileList = array();
        if (!is_dir($realPath)) {
            $info["Err"] = "not a directory";
            return json_encode($info);
        }
        $dh = opendir($realPath);
        $fileNum = 0;
        while (($file = readdir($dh)) !== false) {
            if ($file == "." || $file == "..") {
                continue;
            }
            $fileNum++;
            $filePath = $realPath . "/" . $file;
            $name = $file;
            $time = filemtime($filePath);
            $size = filesize($filePath);
            if ($time === false || $size === false) {
                continue;
            }
            $list = array("Name" => rawurlencode($name), "Time" => $time, "Size" => $size);
            if (is_dir($filePath)) {
                array_push($folderList, $list);
            } else {
                array_push($fileList, $list);
            }
        }
        if ($fileNum == 0) {
            $info["Err"] = "no file found";
            return json_encode($info);
        }
        $info["FolderList"] = json_encode($folderList);
        $info["FileList"] = json_encode($fileList);
        return json_encode($info);
    }

    // postAction ======================================================//
    public function checkToken($token, $isAuth)
    {
        $now = time();
        if ($isAuth) {
            if ($token != md5($this->authKey)) return $this->authFail;
            $newKey = "time" . strval($now);  // key can not be numeric
            $newToken = md5("token" . $newKey . "end");
            $_SESSION[$newKey] = $newToken;
            return $newToken;
        }
        foreach ($_SESSION as $key => $oldToken) {
            $time = intval(substr($key, 4));
            // error_log($now . " " . $time . " " . ($now - $time));
            if (($now - $time) > $this->sessionTime * 60) {
                unset($_SESSION[$key]);
            } else if ($oldToken == $token) {
                unset($_SESSION[$key]);
                $newKey = "time" . strval($now);
                $_SESSION[$newKey] = $token;
                return $this->authPass;
            }
        }
        return $this->authFail;
    }

    public function postAuth($token)
    {
        return $this->checkToken($token, true);
    }

    public function postClose($token)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            foreach ($_SESSION as $key => $oldToken) {
                if ($oldToken == $token) {
                    unset($_SESSION[$key]);
                    return $token;
                }
            }
            return "";
        }
        return $this->authFail;
    }

    public function postMkdir($token, $realPath)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            if (file_exists($realPath)) {
                return "exist";
            }
            if (mkdir($realPath, 0777, true)) {
                return "pass";
            }
            return "fail";
        }
        return $this->authFail;
    }

    public function postRemove($token, $realPath)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            $dirPath = substr($realPath, 0, strrpos($realPath, "/"));
            $name =  substr($realPath, strrpos($realPath, "/") + 1);
            $trashPath = $dirPath . "/" . $this->trashDir;
            $trashFile = $trashPath . "/" . $name;
            if (strpos($dirPath, $this->trashDir) !== false) {
                return "exist";
            }
            if (!file_exists($trashPath)) {
                if (mkdir($trashPath, 0777, true) === false) {
                    return "fail";
                }
            }
            if (file_exists($trashFile)) {
                $trashFile .= "_" . strval(time());
            }
            if (rename($realPath, $trashFile)) {
                return "pass";
            }
            return "fail";
        }
        return $this->authFail;
    }

    public function postRename($token, $oriPath, $newPath)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            if (file_exists($newPath)) {
                return "exist";
            }
            if (rename($oriPath, $newPath)) {
                return "pass";
            }
            return "fail";
        }
        return $this->authFail;
    }

    // upload ===================================================//
    public function uploadCheck($token, $realPath, $fileMd5, $chunksStr)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            $chunks = intval($chunksStr);
            $result = array("finished" => [], "exist" => []);
            if (file_exists($realPath)) {
                array_push($result["exist"], "exist");
            }
            for ($i = 0; $i < $chunks; $i++) {
                $fileNum = strval($i);
                $chunkPath = $realPath . "_" . $fileMd5 . "_" . $fileNum . ".tmp";
                if (file_exists($chunkPath)) {
                    array_push($result["finished"], $fileNum);
                }
            }
            return json_encode($result);
        }
        return $this->authFail;
    }

    public function uploadMerge($token, $realPath, $fileMd5, $chunksStr)
    {
        if ($this->checkToken($token, false) == $this->authPass) {
            $chunks = intval($chunksStr);
            $outFile = fopen($realPath, "wb");
            if ($outFile == null) {
                return $this->signFail;
            }
            for ($i = 0; $i < $chunks; $i++) {
                $chunkPath = $realPath . "_" . $fileMd5 . "_" . strval($i) . ".tmp";
                $inFile = fopen($chunkPath, "rb");
                if ($inFile == null) {
                    return $this->signFail;
                }
                while ($buff = fread($inFile, 4096)) {
                    fwrite($outFile, $buff);
                }
                fclose($inFile);
            }
            for ($i = 0; $i < $chunks; $i++) {
                $chunkPath = $realPath . "_" . $fileMd5 . "_" . strval($i) . ".tmp";
                unlink($chunkPath);
            }
            fclose($outFile);
            return $this->signPass;
        }
        return $this->authFail;
    }

    public function uploadChunk($token, $realPath, $fileMd5, $currentStr, $content)
    {
        // content size should be limited
        if ($this->checkToken($token, false) == $this->authPass) {
            $chunkPath = $realPath . "_" . $fileMd5 . "_" . $currentStr . ".tmp";
            move_uploaded_file($content, $chunkPath);
            return $this->signPass;
        }
        return $this->authFail;
    }
}
