<?php

$confPath = __DIR__ . "/../config.json";
$setting = getConfig($confPath);
$dataPath = $setting["dataPath"];
$authKey = $setting["authKey"];
$sessionTime = intval($setting["sessionTime"]);

require(__DIR__ . "/monitor.php");
require(__DIR__ . "/fileProc.php");
$monitor = new monitor();
$fileProc = new fileProc(array(
    "sessionTime" => 10, "authKey" => $authKey, "homePage" => "./home.html", "trashDir" => ".trash",
    "indexList" => array("index.html", "index.htm", "index.php"),
));

function getConfig($confPath) {
    $results =  @file_get_contents($confPath);
    return json_decode($results, true);
}

function getRealPath($urlPath, $targetPath, $webPath)
{
    // $urlPath is rawurlencoded
    // return realpath: /Data/a, urlPath: %2FData%2Fa 
    if (substr($targetPath, -1) == "/") $targetPath = substr($targetPath, 0, -1);
    if (substr($webPath, -1) == "/") $webPath = substr($webPath, 0, -1);
    $oriPathList = explode("/", rawurldecode($urlPath));
    $pathList = array();
    $oriLength = count($oriPathList);
    for ($i = 0; $i < $oriLength; $i++) {
        if (trim($oriPathList[$i]) == "..") array_pop($pathList);
        else if (trim($oriPathList[$i]) != "") array_push($pathList, $oriPathList[$i]);
    }
    $pathLength = count($pathList);
    if ($pathLength == 0) {
        return array(
            "realPath" => $targetPath . "/",
            "urlPath" => rawurlencode("/")
        );
    } else {
        $subPath = "";
        for ($i = 0; $i < $pathLength; $i++) {
            $subPath .= "/" . $pathList[$i];
        }
        if ($webPath != "" && strpos($subPath, $webPath) == 0) {
            $subPath = substr($subPath, strlen($webPath));
        }
        return array(
            "realPath" => $targetPath . $subPath,
            "urlPath" => rawurlencode($webPath . $subPath)
        );
    }
}

function call()
{
    global $monitor, $fileProc, $dataPath;
    parse_str($_SERVER['QUERY_STRING'], $query);
    if (!array_key_exists("method", $query)) {
        if (!array_key_exists("path", $query) || $query["path"] == "") {
            $target = substr($_SERVER["REQUEST_URI"], 0, strpos($_SERVER["REQUEST_URI"], "?")) . "?path=/";
            $fileProc->reDirect(302, $target);
            return;
        }
        $path = getRealPath($query["path"], $dataPath, "/");
        $fileProc->sendStatic(true, $path["realPath"]);
        return;
    }
    switch ($query["method"]) {
        case "monitor":
            echo $monitor->getInfo();
            break;
        case "getDir":
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->readDirSync($path["realPath"]);
            break;
        case "getFile":
            $path = getRealPath($query["path"], $dataPath, "/");
            $fileProc->sendFile(true, $path["realPath"]);
            break;
        case "auth":
            echo $fileProc->postAuth($query["token"]);
            break;
        case "close":
            echo $fileProc->postClose($query["token"]);
            break;
        case "mkdir":
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->postMkdir($query["token"], $path["realPath"]);
            break;
        case "remove":
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->postRemove($query["token"], $path["realPath"]);
            break;
        case "rename":
            $path = getRealPath($query["path"], $dataPath, "/");
            $newLink = rawurldecode($query["newLink"]);
            parse_str(substr($newLink, strpos($newLink, '?') + 1), $newQuery);
            $newPath = getRealPath($newQuery["path"], $dataPath, "/");
            echo $fileProc->postRename($query["token"], $path["realPath"], $newPath["realPath"]);
            break;
        case "check":
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->uploadCheck($query["token"], $path["realPath"], $query["fileMd5"], $query["chunks"]);
            break;
        case "chunk":
            $buffer = $_FILES[$query["current"]]["tmp_name"];
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->uploadChunk($query["token"], $path["realPath"], $query["fileMd5"], $query["current"], $buffer);
            break;
        case "merge":
            $path = getRealPath($query["path"], $dataPath, "/");
            echo $fileProc->uploadMerge($query["token"], $path["realPath"], $query["fileMd5"], $query["chunks"]);
            break;
        default:
            echo "action not supported";
    }
}

call();

