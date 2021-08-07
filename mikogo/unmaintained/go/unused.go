// unused alternative
func getProcOri() {
	
	var stdout, err = execShell("ps -aux 2>&1")
	if err == "" {
		process.Detail = stdout
		var info = strSplit(stdout, "\n")
		var totalProc = 0
		var users []string
		var nums []int
		for i := 1; i < len(info); i++ {
			var user = strTrim(info[i], " ")
			user = strSlice(user, 0, strIndex(user, " "))
			if user == "" {
				continue
			}
			totalProc++
			var j = 0
			for j = 0; j < len(users); j++ {
				if users[j] == user {
					nums[j]++
					break
				}
			}
			if j == len(users) {
				users = append(users, user)
				nums = append(nums, 1)
			}
		}
		var generalProc = "Total: " + itoa(int64(totalProc))
		for i := 0; i < len(users); i++ {
			generalProc += " | " + users[i] + ": " + itoa(int64(nums[i]))
		}
		process.General = generalProc
	}
}

// unused alternative
func getNetOri() {
	var stdout, err = execShell("ifconfig 2>&1")
	if err == "" {
		network = []networkType{}
		var info = strSplit(stdout, "\n\n")
		for i := 0; i < len(info); i++ { // devices
			var infoNet networkType
			infoNet.Dev = strSlice(info[i], 0, strIndex(info[i], ":"))
			if infoNet.Dev == "lo" || info[i] == "" {
				continue
			}
			var subInfo = strSplit(info[i], "\n")
			for j := 0; j < len(subInfo); j++ {
				var tmpInfo = subInfo[j]
				if strIndex(tmpInfo, "inet ") != -1 {
					var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, "inet ")+5, 0), " ")
					// infoNet.Ipv4 = strSlice(tmp, 0, strIndex(tmp, " "))
				}
				if strIndex(tmpInfo, "inet6 ") != -1 {
					var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, "inet6 ")+6, 0), " ")
					// infoNet.Ipv6 = strSlice(tmp, 0, strIndex(tmp, " "))
				}
				if strIndex(tmpInfo, "RX packets ") != -1 {
					var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, "bytes ")+6, 0), " ")
					infoNet.RxBytes = strSlice(tmp, 0, strIndex(tmp, " "))
				}
				if strIndex(tmpInfo, "TX packets ") != -1 {
					var tmp = strTrim(strSlice(tmpInfo, strIndex(tmpInfo, "bytes ")+6, 0), " ")
					infoNet.TxBytes = strSlice(tmp, 0, strIndex(tmp, " "))
				}
			}
			network = append(network, infoNet)
		}
	}
}