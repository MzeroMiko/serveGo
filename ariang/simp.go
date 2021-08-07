package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"
	"path/filepath"
	"strings"
	"encoding/json"
)

var confFile,  _ = filepath.Abs(os.Args[1])
var confPath = filepath.Dir(confFile)

var setting map[string]string = getConfig(confFile)
var homeConf map[string]string = getCallConf(setting["homeServe"])[0]
var filePath string = confPath + "/" + setting["filePath"]
var httpsCrt string = confPath + "/" + setting["httpsCrt"]
var httpsKey string = confPath + "/" + setting["httpsKey"]

func unjsonify(jsonStr string, v interface{}) string {
	// var str = `{"Name":"junbin", "Age":21, "Gender":true}`
	var err = json.Unmarshal([]byte(jsonStr), v);
	if (err == nil) {
		return "";
	}
	return err.Error();
}

func strSplit(str string, sep string) []string {
	// strSplit("12  34    56    ", " ") return {12,34,56}
	// func (str string) split(sep string) []string  is not allowed
	// return strings.Split(str, sep) // it would return many "" strings
	var result = []string{}
	for {		
		str = strings.Trim(str, sep) // delete sep before and after string
		if str == "" { break; }
		// pos can not be 0 or len(str), cuz trim
		var pos = strings.Index(str, sep);
		if pos == -1 {
			result = append(result, str);
			break;
		} else {
			result = append(result, str[0:pos])
			str = str[pos: len(str)]
		}
	}
	return result
}

func getConfig(confFile string) map[string]string {
	var tmp map[string]string
	if results, err := ioutil.ReadFile(confFile); err == nil {
		fmt.Println(unjsonify(string(results), &tmp))
	}
	return tmp
}

func getCallConf(callConfs string) [](map[string]string) {
	// "...": "https:9090:/cockpit, http:9091:/transmission"
	var results = make([](map[string]string), 0)
	var configs = strSplit(callConfs, ",")
	var configNum = len(configs)
	for i := 0; i < configNum; i++ {
		var config = strSplit(configs[i], ":")
		var protocal = config[0]
		var portPath = config[1] 
		var callPath = config[2]
		if portPath[0] != "/"[0] {
			portPath = ":" + portPath
		}
		if callPath[0] != "/"[0] {
			callPath = "/" + callPath
		}
		results = append(results, map[string]string{"protocal": protocal, "portPath": portPath, "callPath": callPath})
	}
	return results
}

func main() {
	http.HandleFunc("/", func(Response http.ResponseWriter, Request *http.Request) {
		var content, err = ioutil.ReadFile(filePath)
		if err != nil {
			Response.WriteHeader(404)
			Response.Write(make([]byte, 0))
			fmt.Println(err.Error())
			return
		}
		Response.Header().Set("Content-Type", "text/html; charset=utf-8")
		Response.WriteHeader(200)
		Response.Write(content)
	})

	var httpPort = homeConf["portPath"]
	fmt.Println(time.Now())
	fmt.Printf("go httpServer ( pid : %d ) starts at port %s with config file \"%s\"\n", os.Getpid(), httpPort, confFile)
	if homeConf["protocal"] == "https" {
		var err = http.ListenAndServeTLS(httpPort, httpsCrt, httpsKey, nil)
		if err != nil {
			panic("ListenAndServeTLS: " + err.Error())
		}
	} else {
		var err = http.ListenAndServe(httpPort, nil)
		if err != nil {
			panic("ListenAndServe: " + err.Error())
		}
	}
}


