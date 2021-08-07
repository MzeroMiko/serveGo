package main
import (
	"net/url"
	"strconv"
	"strings"
	"encoding/json"
	// "fmt"
)

func encodeURIComponent(str string) string {
	// return url.PathEscape(str);
	var r = url.QueryEscape(str);
	return strings.Replace(r, "+", "%20", -1);
}

func decodeURIComponent(str string) string {
	var r, _ = url.PathUnescape(str);
	// var r, _ = url.QueryUnescape(str);
	return r;
}

func atoi(str string) int64 {
	if num, err := strconv.ParseInt(str, 10, 64); err == nil {
		return num;
	}
	return 0;
}

func itoa(num int64) string {
	return strconv.FormatInt(num, 10);
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

func strJoin(arr []string, sep string) string {
	return strings.Join(arr, sep)
}

func strTrim(str string, cutset string) string {
	return strings.Trim(str, cutset)
}

func strIndex(str string, substr string) int {
	var index = strings.Index(str, substr);
	if index == -1 {
		return -1; // not found
	} 
	return index;
}

func strLastIndex(str string, substr string) int {
	var index = strings.LastIndex(str, substr);
	if index == -1 {
		return -1; // not found
	} 
	return index;
}

func strSlice(str string, start int, stop int) string {
	// strSlice(str,1,0); strSlice(str,1,-1);
	var strlen = len(str);
	if (stop > strlen || start < -1*strlen) {
		return "";
	}
	if (start < 0) {
		start = start + strlen;
	}
	if (stop <= 0) {
		stop = stop + strlen;
	}
	if (start > stop) {
		return "";
	}
	return str[start:stop];
}

func jsonify(v interface{}) string {
	var bytes, err = json.Marshal(v);
	if (err == nil) {
		return string(bytes);
	}
	return err.Error();
}

func unjsonify(jsonStr string, v interface{}) string {
	// var str = `{"Name":"junbin", "Age":21, "Gender":true}`
	var err = json.Unmarshal([]byte(jsonStr), v);
	if (err == nil) {
		return "";
	}
	return err.Error();
}

