// monitor ================================//
function PieProgress(pieBox, opts) {
    // parameters ============================================//
    if (typeof pieBox == "string") pieBox = document.querySelector(pieBox);
    if (typeof opts == "undefined") opts = {};
    var basicSize = ("basicSize" in opts) ? opts.basicSize : "120px";
    var speedTime = ("speedTime" in opts) ? opts.speedTime : 8; // update after speedTime (ms)
    var centerColor = ("centerColor" in opts) ? opts.centerColor : "#fff";
    var progressColor = ("progressColor" in opts) ? opts.progressColor : "#aae";
    var noProgressColor = ("noProgressColor" in opts) ? opts.noProgressColor : "#dadada";

    // html and style ===========================================// 
    {
        var pieProgressStyle = '\
            .backCircle,.leftCircle,.rightCircle{position:absolute;border-radius:50%;height:1em;width:1em;}\
            .centerCircle,.centerInfo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);}\
            .backCircle{background:' + progressColor + ';}\
            .leftCircle{background:' + noProgressColor + ';clip:rect(0,0.5em,1em,0);}\
            .leftCircle{background:' + noProgressColor + ';clip:rect(0,0.5em,1em,0);}\
            .rightCircle{background:' + noProgressColor + ';clip:rect(0,1em,1em,0.5em);}\
            .centerCircle{height:0.86em;width:0.86em;border-radius:50%;background:' + centerColor + ';}\
            .centerInfo{font-size:0.23em;font-weight:600;white-space:nowrap;}';
        var pieProgressHtml = '<div style="margin:auto;overflow:hidden;height:1em;width:1em;\
            position:relative;font-size:' + basicSize + '; "><div class="backCircle"></div>\
            <div class="leftCircle"></div><div class="rightCircle"></div>\
            <div class="centerCircle"></div><div class="centerInfo">-%</div></div>';
    }
    insertStyleHtml(pieProgressStyle, pieProgressHtml, pieBox);

    // locals =====================================================//
    var centerInfo = pieBox.querySelector(".centerInfo");
    var rightCircle = pieBox.querySelector(".rightCircle");

    function updatePie(current, percent) {
        if (current == percent) return;
        if (current < percent) current++;
        else if (current > percent) current--;
        else current = percent;
        centerInfo.innerText = current + " %";
        var degree;
        if (current < 0) degree = 0;
        else if (current < 50) degree = current * 3.6;
        else if (current < 100) degree = current * 3.6 - 180;
        else degree = 180;
        rightCircle.style.transform = 'rotate(' + degree + 'deg' + ')';
        rightCircle.style.backgroundColor = (current < 50) ? noProgressColor : progressColor;
        setTimeout(function () { updatePie(current, percent) }, speedTime)
    }

    // methods =======================================================//
    var lastPercent = 0;
    this.update = function (percent) {
        updatePie(lastPercent, percent);
        lastPercent = percent;
    }
}

function MonitorFront(monitorBox, opts) {
    // parameters ==================================//
    if (typeof monitorBox == "string") monitorBox = document.querySelector(monitorBox);
    if (typeof opts == "undefined") opts = {};
    var basicSize = ("basicSize" in opts) ? opts.basicSize : "14px";
    var waitTime = ("waitTime" in opts) ? opts.waitTime : 3000;
    var getMonitor = ("getMonitor" in opts) ? opts.getMonitor : function () { };

    // html and style ==================================//
    {
        var monitorStyle = '\
            .leftcol {width:21%;float:left;} .rightcol {overflow:hidden;}\
            .card {box-sizing:border-box;display:block;padding:0.8em;\
                margin:0.6em 0.6em;border-radius:0.4em;overflow:hidden;background-color:#fff;}\
            .card .title {font-size:1.2em;font-weight:600;}\
            .card .item {font-weight:600;text-align:center;color:#666;}\
            .card .info {font-size:1.1em;font-weight:600;text-align:center;}\
            .card .preinfo {font-weight:550;text-align:left;color:#333;\
                overflow:auto;white-space:pre;font-family:"consolas","monospace","serif";}\
            .column2, .column3 {box-sizing:border-box;display:block;float:left;overflow:hidden;}\
            .column2 {width:50%;} .column3 {width:33.33333%;}\
            @media screen and (max-width:42em) {\
                .leftcol, .rightcol, .column2,.column3 {float:none;width:100%;padding:0;}}';

        var cardGeneral = '\
            <div class="card uptime" style="background-color: #fed;">           \
            <div class="item">Uptime</div><div class="info">-</div></div>       \
            <div class="card distro" style="background-color: #ffd;">           \
            <div class="item">Distribution</div><div class="info">-</div></div> \
            <div class="card host" style="background-color: #efd;">             \
            <div class="item">Hostname</div><div class="info">-</div></div>     \
            <div class="card net" style="background-color: #dfd;">              \
            <div class="preinfo" style="height: 8em;"></div></div>              \
            <div class="card version" style="background-color: #def;">          \
            <div class="item">-</div></div>                                     ';
        var cardMain3 = '\
            <div class="column3 cpu"><div class="card"><div class="title">Cpu</div>         \
            <div class="pie" style="padding-bottom: 1.5em;"></div><div class="info">-</div> \
            <div class="card" style="background-color: #ffe;">                              \
            <div class="preinfo" style="height: 12em;"></div></div></div></div>             \
            <div class="column3 mem"><div class="card"><div class="title">Memory</div>      \
            <div class="pie" style="padding-bottom: 1.5em;"></div><div class="info">-</div> \
            <div class="card" style="background-color: #efe;">                              \
            <div class="preinfo" style="height: 12em;"></div></div></div></div>             \
            <div class="column3 disk"><div class="card"><div class="title">Disk</div>       \
            <div class="pie" style="padding-bottom: 1.5em;"></div><div class="info">-</div> \
            <div class="card" style="background-color: #eef;">                              \
            <div class="preinfo" style="height: 12em;"></div></div></div></div>            ';
        var cardTransmission = '\
            <div class="column3 rxSpeed">                                   \
            <div class="card" style="background-color: #eff; color: #333;"> \
            <div class="info">Rx Speed: 0 KB/s</div></div></div>            \
            <div class="column3 txSpeed">                                   \
            <div class="card" style="background-color: #eef; color: #333;"> \
            <div class="info">Tx Speed: 0 KB/s</div></div></div>            \
            <div class="column3 totalSpeed">                                \
            <div class="card" style="background-color: #fef; color: #333;"> \
            <div class="info">Total Speed: 0 KB/s</div></div></div>         ';

        var monitorHtml = '<div style="overflow:auto;height:100%;font-size:' + basicSize + '">\
            <div class="leftcol"><div class="card"><div class="title">General</div>' + cardGeneral + '</div>\
            </div><div class="rightcol">\
            <div style="box-sizing:border-box;overflow:hidden;">' + cardMain3 + '</div>\
            <div class="card" style="margin-top:0;">\
            <div class="title">Transmission</div>' + cardTransmission + '</div>\
            </div></div>';
    }
    insertStyleHtml(monitorStyle, monitorHtml, monitorBox);

    // locals ========================================//
    var cpuPie = new PieProgress(monitorBox.querySelector(".cpu .pie"), { progressColor: "#eda" });
    var memPie = new PieProgress(monitorBox.querySelector(".mem .pie"), { progressColor: "#aed" });
    var diskPie = new PieProgress(monitorBox.querySelector(".disk .pie"), { progressColor: "#aae" });

    var infoTimeout;
    var lastCpuIdles = [], lastCpuTotals = [], cpuUsages = [33];
    var lastRxBytes = 0, lastTxBytes = 0, lastTime = 0;

    function getInfo(waitTime) {
        getMonitor(function (info) {
            updateInfo(info);
            infoTimeout = setTimeout(function () { getInfo(waitTime); }, waitTime);
        });
    }
    function updateInfo(monitorInfo) {

        function updateText(selector, info) {
            if (!info) info = "-";
            monitorBox.querySelector(selector).innerText = info;
        }

        function updateCpu(CpuInfo) {
            if (!CpuInfo) return;
            try {
                var detailCpu = "core: " + CpuInfo.Core + "\n"
                    + "temp: " + (CpuInfo.Temperature ? CpuInfo.Temperature : "-") + " tC\n"
                    + "name: " + CpuInfo.Name + "\n";
                var cpuTotals = JSON.parse(CpuInfo.Totals);
                var cpuIdles = JSON.parse(CpuInfo.Idles);
                if (cpuTotals.length != lastCpuTotals.length) {
                    lastCpuTotals = [], lastCpuIdles = [];
                    for (var i = 0; i < cpuTotals.length; i++) {
                        lastCpuTotals.push(0);
                        lastCpuIdles.push(0);
                    }
                }
                for (var i = 0; i < cpuTotals.length; i++) {
                    if (lastCpuTotals[i] != cpuTotals[i]) {
                        cpuUsages[i] = (cpuIdles[i] - lastCpuIdles[i]) / (cpuTotals[i] - lastCpuTotals[i]);
                        cpuUsages[i] = 100 - 100 * cpuUsages[i];
                        lastCpuIdles[i] = cpuIdles[i], lastCpuTotals[i] = cpuTotals[i];
                        if (i != 0)
                            detailCpu += "cpu" + i.toString() + ': ' + cpuUsages[i].toFixed(3) + '%\n';
                    }

                }
                cpuPie.update(Math.round(cpuUsages[0]));
                updateText(".cpu .preinfo", detailCpu);
                updateText(".cpu .info", "load: " + CpuInfo.Loadavg);
            } catch (err) { console.log(err) }
        }

        function updateMem(MemInfo) {
            if (!MemInfo) return;
            try {
                var memTotal = MemInfo.MemTotal;
                var memUsed = memTotal - MemInfo.MemFree - MemInfo.Cached;
                var detailMem = "MemTotal: \t" + (memTotal >> 10) + " MB\n"
                    + "MemFree: \t" + (MemInfo.MemFree >> 10) + " MB\n"
                    + "MemCached: \t" + (MemInfo.Cached >> 10) + " MB\n"
                    + "SwapTotal: \t" + (MemInfo.SwapTotal >> 10) + " MB\n"
                    + "SwapFree: \t" + (MemInfo.SwapFree >> 10) + " MB\n"
                    + "SwapCached: \t" + (MemInfo.SwapCached >> 10) + " MB\n"
                    + "Buffers: \t" + (MemInfo.Buffers >> 10) + " MB\n"
                memPie.update((memTotal) ? Math.round(100 * memUsed / memTotal) : 0);
                updateText(".mem .info", (memUsed >> 10) + " / " + (memTotal >> 10) + " MB");
                updateText(".mem .preinfo", detailMem);
            } catch (err) { console.log(err.toString()) }
        }

        function updateNet(Network) {
            if (!Network) return;
            try {
                var netNumber = Network.length, detailNet = "";
                var rxSpeed = 0, txSpeed = 0;
                var rxBytes = 0, txBytes = 0, time = new Date().getTime();
                for (var i = 0; i < netNumber; i++) {
                    var netInfo = Network[i];
                    rxBytes += Number(netInfo.RxBytes);
                    txBytes += Number(netInfo.TxBytes);
                    detailNet = detailNet
                        + "Devices: " + netInfo.Dev + "\n"
                        + "TotalRx: " + (Number(netInfo.RxBytes) / (1 << 30)).toFixed(3) + " GB\n"
                        + "TotalTx: " + (Number(netInfo.TxBytes) / (1 << 30)).toFixed(3) + " GB\n\n";
                }
                rxSpeed = (rxBytes - lastRxBytes) / (time - lastTime);
                txSpeed = (txBytes - lastTxBytes) / (time - lastTime);
                lastRxBytes = rxBytes; lastTxBytes = txBytes; lastTime = time;
                updateText(".rxSpeed .info", "Rx Speed: " + rxSpeed.toFixed(2) + " KB/s");
                updateText(".txSpeed .info", "Tx Speed: " + txSpeed.toFixed(2) + " KB/s");
                updateText(".totalSpeed .info", "Total Speed: " + (rxSpeed + txSpeed).toFixed(2) + " KB/s");
                updateText(".net .preinfo", detailNet);
            } catch (err) { console.log(err) }
        }

        function updateDisk(DiskInfo) {
            if (!DiskInfo) return;
            try {
                diskPie.update(Math.round(DiskInfo.Usage));
                updateText(".disk .info", "usage of / : " + DiskInfo.Usage + " %");
                updateText(".disk .preinfo", DiskInfo.Detail);
            } catch (err) { console.log(err.toString()) }
        }

        try {
            updateCpu(JSON.parse(monitorInfo.CpuInfo));
            updateMem(JSON.parse(monitorInfo.MemInfo));
            updateNet(JSON.parse(monitorInfo.Network));
            updateDisk(JSON.parse(monitorInfo.DiskInfo));
            updateText(".uptime .info", monitorInfo.Uptime);
            updateText(".distro .info", monitorInfo.Distro);
            updateText(".host .info", monitorInfo.Host);
            updateText(".version .item", monitorInfo.Version);
        } catch (err) { console.log(err.toString()) }
    }

    // methods ======================================//
    this.open = function () { getInfo(waitTime); }
    this.close = function () { clearTimeout(infoTimeout); }
}

// media player=============================//
function SliderBar(sliderBox, opts) {
    // parameters =============================//
    if (typeof sliderBox == "string") sliderBox = document.querySelector(sliderBox);
    if (typeof opts == "undefined") opts = {};
    var sliderColor = ("sliderColor" in opts) ? opts.sliderColor : "#ddd";
    var bufferColor = ("bufferColor" in opts) ? opts.bufferColor : "#aaa";
    var progressColor = ("progressColor" in opts) ? opts.progressColor : "#2d3";

    // html and style ===============================//
    sliderBox.innerHTML = '\
        <div class="backdrop" style="overflow:hidden;width:100%;">              \
        <div class="contain" style="padding:8px 0;margin:0 8px;cursor:pointer;">\
        <div class="slider" style="height:3px;position:relative;                \
        border-radius:1px;background:' + sliderColor + ';">                     \
        <div class="buffer" style="height:100%;width:0%;position:absolute;      \
        border-radius:1px;background:' + bufferColor + ';"></div>               \
        <div class="prog" style="height:100%;width:0%;position:absolute;        \
        border-radius:1px;background:' + progressColor + ';"></div>             \
        <div class="point" style="height:9px;width:9px;position:absolute;       \
        transform:translate(-5px,-3px);left:0%;border-radius:50%;               \
        background:' + progressColor + ';"></div></div></div></div>             ';

    // methods ===================================//
    this.setClickCallBack = function (callback) {
        var contain = sliderBox.querySelector('.contain');
        contain.onclick = function (evt) {
            // may get wrong using evt.offsetX
            callback((evt.clientX - evt.currentTarget.offsetLeft) / contain.offsetWidth);
        }
    }
    this.updateCurrent = function (current) {
        // current:  support 0.6 60 60%
        var tmp = Math.abs(100 * parseFloat(current));
        tmp = (tmp <= 100) ? (tmp) + "%" : (tmp / 100) + "%";
        sliderBox.querySelector('.prog').style.width = tmp;
        sliderBox.querySelector('.point').style.left = tmp;
    }
    this.updateBuffer = function (buffer) {
        // buffer:  support 0.6 60 60%
        var tmp = Math.abs(100 * parseFloat(buffer));
        tmp = (tmp <= 100) ? (tmp) + "%" : (tmp / 100) + "%";
        sliderBox.querySelector('.buffer').style.width = tmp;
    }
}

function MediaPlayer(mediaBox, opts) {
    // parameter ============================================//
    if (typeof mediaBox == "string") mediaBox = document.querySelector(mediaBox);
    if (typeof opts == "undefined") opts = {};
    var media = ("media" in opts) ? opts.media : "";
    if (media && (typeof media == "string")) media = document.querySelector(media);
    var enFullScreen = ("enFullScreen" in opts) ? opts.enFullScreen : false;
    var enMediaName = ("enMediaName" in opts) ? opts.enMediaName : true;
    var forwardStep = ("forwardStep" in opts) ? opts.forwardStep : 5;
    var backColor = ("backColor" in opts) ? opts.backColor : "#777";
    var themeColor = ("themeColor" in opts) ? opts.themeColor : "#fff";
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
        var orderBtnHtml = '<divicon style="height:1em;width:1em;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;">'
            + '<div class="orderStat" style="font-size:0.6em;font-weight:800;overflow:hidden;'
            + 'color:' + themeColor + '; ">A</div></divicon>';
        var playBtnHtml = '<divicon style="background:' + playBtnColor + ';border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0.1em;height:0.5em;"></div>'
            + '<div style="width:0;height:0;border-left:0.5em solid ' + themeColor + ';'
            + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
            + '</divicon>';
        var pauseBtnHtml = '<divicon style="background:' + playBtnColor + ';border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0.17em;height:0.5em;background:' + themeColor + ';"></div>'
            + '<div style="width:0.16em;height:0.5em;background:transparent;"></div>'
            + '<div style="width:0.17em;height:0.5em;background:' + themeColor + ';"></div>'
            + '</divicon>';
        var prevBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0.1em;height:0.5em;background:' + themeColor + ';"></div>'
            + '<div style="width:0;height:0;border-right:0.4em solid ' + themeColor + ';'
            + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
            + '</divicon>';
        var nextBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0;height:0;border-left:0.4em solid ' + themeColor + ';'
            + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
            + '<div style="width:0.1em;height:0.5em;background:' + themeColor + ';"></div>'
            + '</divicon>';
        var volBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0.16em;height:0.24em;background:' + themeColor + ';"></div>'
            + '<div style="width:0;height:0.24em;border-right:0.24em solid ' + themeColor + ';'
            + 'box-sizing:content-box;'
            + 'border-top:0.13em solid transparent;border-bottom:0.13em solid transparent;"></div>'
            + '<div style="width:0.1em;height:0.5em;"></div>'
            + '</divicon>';
        var fullBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
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
            + '</div></divicon>';
        var noFullBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
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
            + '</div></divicon>';
        var backwardBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0;height:0;border-right:0.25em solid ' + themeColor + ';'
            + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
            + '</divicon>';
        var forwardBtnHtml = '<divicon style="background:transparent;border-radius:50%;cursor:pointer;'
            + 'display:flex;align-items:center;justify-content:center;height:1em;width:1em;">'
            + '<div style="width:0;height:0;border-left:0.25em solid ' + themeColor + ';'
            + 'border-top:0.25em solid transparent;border-bottom:0.25em solid transparent;"></div>'
            + '</divicon>';
    }
    {
        mediaBox.innerHTML = '<audio></audio>\
            <div class="backdrop" tabIndex="1" style="outline:none;         \
            padding:8px;background:' + backColor + ';">                     \
            <div style="display:flex;align-items:center;                    \
            padding:0 10px;font-size:14px;font-weight:600;">                \
            <div class="timeSlider" style="flex:auto;"></div>               \
            <div class="mediaTime" style="padding-left:10px;                \
            color:' + themeColor + ';">00:00/00:00</div>                    \
            <div class="exitBtn" style="padding-left:10px;cursor:pointer;   \
            color:' + themeColor + ';">Q</div></div>                        \
            <div style="display:flex;align-items:center;padding:0 10px;font-size:2.1em;">\
            <div class="backwardBtn">'+ backwardBtnHtml + '</div>           \
            <div class="forwardBtn">'+ forwardBtnHtml + '</div>             \
            <div class="orderBtn">'+ orderBtnHtml + '</div>                 \
            <div class="prevBtn">'+ prevBtnHtml + '</div>                   \
            <div class="playBtn">'+ playBtnHtml + '</div>                   \
            <div class="nextBtn">'+ nextBtnHtml + '</div>                   \
            <div class="volBtn">'+ volBtnHtml + '</div>                     \
            <div class="volSlider" style="flex-shrink:0;width:60px;"></div> \
            <div class="mediaName" style="font-size:14px;font-weight:600;   \
            flex:auto;text-align:center;color:'+ themeColor + ';            \
            white-space:nowrap;overflow-y:hidden;overflow-x:auto;"></div>   \
            <div class="fullBtn" style="margin-left:auto;">'+ fullBtnHtml + '</div>\
            </div></div>';
    }

    // locals =====================================================//
    var isFullScreen = false;
    var oriPlayList = [], playList = [];
    var playPos = 0, playOrder = "Ascend", currentName = "", currentVolume = 1;
    var cTime = 0, minAskTime = 800;

    if (!media) media = mediaBox.querySelector("audio");
    var backdrop = mediaBox.querySelector(".backdrop");
    var forwardBtn = backdrop.querySelector(".forwardBtn");
    var backwardBtn = backdrop.querySelector(".backwardBtn");
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
    forwardBtn.onclick = function () { playForward(1 * forwardStep); };
    backwardBtn.onclick = function () { playForward(-1 * forwardStep); };
    orderBtn.onclick = function () { playOrderChange(); };
    prevBtn.onclick = function () { playPrev(); };
    playBtn.onclick = function () { playPause(); };
    nextBtn.onclick = function () { playNext(); };
    exitBtn.onclick = function () { playStop(); }
    volBtn.onclick = function () {
        if (media.volume) {
            currentVolume = media.volume;
            media.volume = 0;
        } else {
            media.volume = currentVolume;
        }
        volSlider.updateCurrent(media.volume);
    };
    fullBtn.onclick = function () {
        if (isFullScreen) {
            isFullScreen = false;
            fullBtn.innerHTML = fullBtnHtml;
            exitFullScreen();
        } else {
            isFullScreen = true;
            fullBtn.innerHTML = noFullBtnHtml;
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
        playBtn.innerHTML = pauseBtnHtml;
        volSlider.updateCurrent(media.volume);
    }
    function playPause() {
        if (media.src == "") {
            playPos = Math.floor(Math.random() * (playList.length - 1));
            playThis(playList[playPos]);
        } else if (media.paused) {
            media.play();
            playBtn.innerHTML = pauseBtnHtml;
            volSlider.updateCurrent(media.volume);
        } else {
            media.pause();
            playBtn.innerHTML = playBtnHtml;
            volSlider.updateCurrent(media.volume);
        }
    }
    function playPrev() {
        oriPlayPos = playPos;
        if (playPos == 0) playPos = playList.length - 1;
        else playPos--;
        // if (palyPos == oriPlayPos), means only 1 item
        if (playPos != oriPlayPos) playThis(playList[playPos]);
    }
    function playNext() {
        oriPlayPos = playPos;
        if (playPos == playList.length - 1) playPos = 0;
        else playPos++;
        // if (palyPos == oriPlayPos), means only 1 item
        if (playPos != oriPlayPos) playThis(playList[playPos]);
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
            playBtn.innerHTML = playBtnHtml;
            fullBtn.innerHTML = fullBtnHtml;
            stopCallBack();
        } catch (err) { console.log(err); }
    }
    function playTime(time) {
        if (time >= media.duration) playEnd();
        else {
            media.currentTime = time;
            media.play();
            playBtn.innerHTML = pauseBtnHtml;
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
                break;
            case "Random": playOrder = "Loop"; break;
            case "Loop": playOrder = "Ascend"; playList = oriPlayList.slice(0); break;
            default: playOrder = "Ascend"; playList = oriPlayList.slice(0);
        }
        orderBtn.querySelector(".orderStat").innerText = playOrder.slice(0, 1).toUpperCase();
        playPos = playList.indexOf(currentPlay); // could be -1, if wrong
        if (playPos > playList.length || playPos < 0) playPos = 0;
    }
    function playOrderRecover() {
        // get the playOrder before
        switch (playOrder) {
            case "Ascend": playOrder = "Loop"; break;
            case "Random": playOrder = "Ascend"; break;
            case "Loop": playOrder = "Random"; break;
            default: playOrder = "Loop";
        }
        playOrderChange();
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
    this.playPause = playPause;
    this.playStop = playStop;
    this.fullScreen = function () { fullBtn.click(); }
    this.setPlayList = function (newPlayList) {
        oriPlayList = newPlayList.slice(0); // to copy but not get memory address
        playList = oriPlayList.slice(0);
        playPos = 0;
        playOrderRecover(); // recover playOrder
    }
}

function VideoPlayer(videoBox, opts) {
    // parameters======================//
    if (typeof videoBox == "string") videoBox = document.querySelector(videoBox);
    if (typeof opts == "undefined") opts = {};
    var infoTime = ("infoTime" in opts) ? opts.infoTime : 5000;
    var autoRotate = ("autoRotate" in opts) ? opts.autoRotate : true;
    var backColor = ("backColor" in opts) ? opts.backColor : "#000";
    var themeColor = ("themeColor" in opts) ? opts.themeColor : "#fff";
    var ctrlBackColor = ("infoBackColor" in opts) ? opts.infoBackColor : "rgba(0,0,0,0.4)";
    var stopCallBack = ("stopCallBack" in opts) ? opts.stopCallBack : function () { };

    // html and style ============================//
    videoBox.innerHTML = '<div class="backdrop" style="\
        position:relative;width:100%;height:100%;background:'+ backColor + ';">\
        <video style="outline:none;height:100%;width:100%;position:absolute;"></video>\
        <div class="launchBottom" style="bottom:0px;width:100%;position:absolute;height:40px;"></div>\
        <div class="ctrlBox" style="bottom:0px;width:100%;position:absolute;"></div></div>';

    // locals ====================================//
    var timeout;
    var backdrop = videoBox.querySelector(".backdrop");
    var video = backdrop.querySelector("video");
    var ctrlBox = backdrop.querySelector(".ctrlBox");
    var launchBottom = backdrop.querySelector(".launchBottom");
    var player = new MediaPlayer(ctrlBox, {
        media: video, enFullScreen: true,
        backColor: ctrlBackColor, themeColor: themeColor,
        stopCallBack: stopCallBack, fullScreenEle: videoBox,
        enterFullScreenCallBack: function () { rotateScreen(); },
        exitFullScreenCallBack: function () { removeRotate(); }
    });

    launchBottom.onmouseenter = function () { clearCtrlTimeout(); showCtrl(); }
    ctrlBox.onmouseover = function () { clearCtrlTimeout(); }
    ctrlBox.onmouseleave = function () { clearCtrlTimeout(); hideCtrl(); }
    ctrlBox.onclick = function () { event.cancelBubble = true; }
    ctrlBox.ondblclick = function () { event.cancelBubble = true; }
    backdrop.ondblclick = function () { player.fullScreen(); }
    backdrop.onclick = function () { player.playPause(); showCtrl(); hideCtrl(); }

    function showCtrl() { ctrlBox.style.display = ""; }
    function hideCtrl() { timeout = setTimeout(function () { ctrlBox.style.display = "none"; }, infoTime); }
    function clearCtrlTimeout() { try { clearTimeout(timeout); } catch (err) { } }
    function rotateScreen() {
        // must be in full screen mode, lock is a promise function
        if (!autoRotate) return;
        screen.orientation.lock('landscape-primary').catch(function (err) { });
    }
    function removeRotate() {
        screen.orientation.lock('any').catch(function (err) { });
    }

    // methods =====================================//
    this.setPlayList = function (list) { return player.setPlayList(list); }
    this.thisPos = function (link) { return player.thisPos(link); }
    this.playThis = function (link) { return player.playThis(link); }
    this.playStop = function () { return player.playStop(); }
}

// code viewer ==============================//
function CodeView(codeBox) {
    // parameter ============================================//
    if (typeof codeBox == "string") codeBox = document.querySelector(codeBox);

    // init html and css ===========================================// 
    {
        var codeStyle = '.hljs{display:block;overflow-x:auto;padding:.5em;background:white;color:black}.hljs-comment,.hljs-quote,.hljs-variable{color:#008000}.hljs-keyword,.hljs-selector-tag,.hljs-built_in,.hljs-name,.hljs-tag{color:#00f}.hljs-string,.hljs-title,.hljs-section,.hljs-attribute,.hljs-literal,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-addition{color:#a31515}.hljs-deletion,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-meta{color:#2b91af}.hljs-doctag{color:#808080}.hljs-attr{color:#f00}.hljs-symbol,.hljs-bullet,.hljs-link{color:#00b0e8}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}';
        codeStyle += 'a{text-decoration:none;color:#5ce;} a:hover{text-decoration:underline;} p{line-height:1.5;} blockquote{padding:0 0.5em;margin:0;color:#6a737d;border-left:0.5em solid #dfe2e5;} pre{padding:1em;overflow:auto;line-height:1.5;} table {border-collapse:collapse;} td, th {border:1px solid #ddd;padding:10px 13px;}';
        var codeHtml = '<div style="overflow:auto;height:99%;padding:0 24px;background-color:#fff;"><div class="ctrlBtn" style="padding:0.5em;cursor:pointer;color:#79b;font-weight:600;font-size:1.2em;"></div><div class="container"></div></div>';
    }
    insertStyleHtml(codeStyle, codeHtml, codeBox);

    // locals ==============================================//
    var oriText = "";
    var htmlDist = codeBox.querySelector('.container');
    var ctrlBtn = codeBox.querySelector('.ctrlBtn');
    ctrlBtn.onclick = function () {
        ctrlBtn.setAttribute("contenteditable", "true");
    }
    ctrlBtn.onkeypress = function () {
        if (event.keyCode == "13") {
            ctrlBtn.setAttribute("contenteditable", "false");
            if (ctrlBtn.innerText == "") ctrlBtn.innerText = "plain";
            codeLang(ctrlBtn.innerText);
        }
    }

    function codeLang(language) {
        htmlDist.innerHTML = '<pre><code></code></pre>';
        var codeBlock = htmlDist.querySelector('pre code');
        var result = "";
        if (typeof language == "string") {
            try { result = hljs.highlight(language, oriText, true); }
            catch (err) { result = hljs.highlightAuto(oriText); }
        } else {
            result = hljs.highlightAuto(oriText);
        }
        // hljs.lineNumbersBlock(codeBlock);
        ctrlBtn.innerText = result.language;
        codeBlock.innerHTML = result.value;
    }

    // methods =====================================================//
    this.showMark = function (link) {
        var xhr = new XMLHttpRequest();
        if (xhr == null) return;
        xhr.open("GET", link, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var converter = new showdown.Converter({ emoji: true, underline: true });

                htmlDist.innerHTML = converter.makeHtml(xhr.responseText);
                // renderMathInElement(htmlDist, {
                //     displayMode: true, throwOnError: false, errorColor: '#ff0000',
                //     delimiters: [
                //         {left: "$$", right: "$$", display: true},
                //         {left: "$", right: "$", display: false},
                //         {left: "\\(", right: "\\)", display: false},
                //         {left: "\\[", right: "\\]", display: true}
                //     ],
                // });
                var codeBlocks = htmlDist.querySelectorAll('pre code');
                for (var i = 0; i < codeBlocks.length; i++) {
                    hljs.highlightBlock(codeBlocks[i]);
                    // hljs.lineNumbersBlock(codeBlocks[i]);
                }
            }
        };
        xhr.send(null);
    }
    this.showCode = function (link) {
        var xhr = new XMLHttpRequest();
        if (xhr == null) return;
        xhr.open("GET", link, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                htmlDist.innerHTML = '<pre><code></code></pre>';
                oriText = xhr.responseText;
                codeLang();
            }
        };
        xhr.send(null);
    }
}

// menu admin ===============================//
function PopupMenu(popupBox, opts) {
    // parameters============================//
    if (typeof popupBox == "string") popupBox = document.querySelector(popupBox);
    if (typeof opts == "undefined") opts = {};
    var basicSize = ("basicSize" in opts) ? opts.basicSize : "14px";
    var fontColor = ("fontColor" in opts) ? opts.fontColor : "#fff";
    var defTimeOut = ("defTimeOut" in opts) ? opts.defTimeOut : 2000;
    var nameHolder = ("nameHolder" in opts) ? opts.nameHolder : "user name";
    var passHolder = ("passHolder" in opts) ? opts.passHolder : "password";

    var passColor = "#6d8", infoColor = "#6cd", warnColor = "#fc5", failColor = "#e66";
    var confirmColor = "#a9e", inputColor = "#abb", authColor = "#ea9";

    // html and style ================================//
    {
        var popupStyle = '\
            .card {display:flex;align-items:center;justify-content:space-between;\
                width:24em;overflow:hidden;padding:0.3em;border-radius:0.5em;}\
            .info {position:relative;height:3em;width:3em;cursor:pointer;\
                flex-shrink: 0;border-radius:50%;border:0.2em solid '+ fontColor + ';}\
            .infoText{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);\
                font-size:2em;font-weight:900;color:' + fontColor + ';}\
            .close {width:2em;height:100%;padding:0.5em;cursor:pointer;\
                flex-shrink: 0;border-left:0.2em solid '+ fontColor + ';}\
            .closeText {font-size:2em;font-weight:900;color:' + fontColor + ';}\
            .content{overflow:hidden;padding:0.2em;font-size:1.1em;font-weight:600;}\
            .message {max-height:16em;padding:0.2em;overflow:auto;color:'+ fontColor + ';}\
            .item {display:table-cell;padding:0.2em;color:'+ fontColor + ';}\
            .input{display:table-cell;outline:none;background:transparent;\
                font-size:1em;font-weight:600;padding:0.2em;border-width:0 0 0.2em 0;\
                color:'+ fontColor + ';border-bottom:inset ' + fontColor + ';}';

        var messageCoreHtml = '<div class="message" style=""></div><input class="input" type="text"/>';
        var authCoreHtml = '<form style="display:table;">\
            <div style="display:table-row;"><div class="item">N</div>\
            <input class="name input" type="text" autocomplete="off"/></div>\
            <div style="display:table-row;"><div class="item">P</div>\
            <input class="pass input" type="password" autocomplete="off"/></div></form>';
        var popupBody = '<div class="card"><div class="info"><div class="infoText"></div></div>\
            <div class="content"></div><div class="close"><div class="closeText">Q</div></div></div>';
        var popupHtml = '<div class="container" style="font-size:' + basicSize + ';"></div>'
    }
    insertStyleHtml(popupStyle, popupHtml, popupBox);

    // locals =========================================//
    var container = popupBox.querySelector(".container");

    function appendBody(infoText, cardColor, timeOut) {
        // timeOut = 0: do not diaspear
        var newBody = document.createElement("div");
        newBody.style = "margin:auto;overflow:hidden;padding:0.4em;";
        newBody.innerHTML = popupBody;
        container.appendChild(newBody);
        newBody.querySelector(".card").style.backgroundColor = cardColor;
        newBody.querySelector(".infoText").innerText = infoText;
        newBody.querySelector(".close").onclick = function () {
            container.removeChild(newBody);
        };
        if (typeof timeOut == "undefined") timeOut = defTimeOut;
        if (timeOut) setTimeout(function () { container.removeChild(newBody); }, timeOut);
        return newBody;
    }

    // methods ============================================//
    this.clearAll = function () { container.innerHTML = ""; }
    this.appendMessage = function (status, content, confirmCallBack) {
        var defInput = "", messageText = "";
        if (typeof confirmCallBack == "undefined") confirmCallBack = function (extraInput) { };
        if (typeof content == "object") {
            if ("input" in content) defInput = content.input;
            if ("message" in content) messageText = content.message;
        } else messageText = content.toString();

        // append new Body
        var newMessage = null;
        switch (status.trim()) {
            case "input": newMessage = appendBody("#", inputColor, 0); break;
            case "confirm": newMessage = appendBody("C", confirmColor, 0); break;
            case "success": case "pass": newMessage = appendBody("S", passColor); break;
            case "warning": case "warn": newMessage = appendBody("!", warnColor); break;
            case "error": case "fail": newMessage = appendBody("X", failColor); break;
            case "info": default: newMessage = appendBody("i", infoColor); break;
        }

        // set content
        var content = newMessage.querySelector(".content");
        content.innerHTML = messageCoreHtml;
        content.querySelector(".message").innerText = messageText;
        var input = content.querySelector("input");
        input.value = defInput;
        if (status == "input") input.style.display = "block";
        else input.style.display = "none";
        input.onkeypress = function () {
            if (event.keyCode == 13 || event.which == 13) {
                container.removeChild(newMessage);
                confirmCallBack(input.value);
            }
        }
        newMessage.querySelector(".info").onclick = function () {
            confirmCallBack(input.value);
            container.removeChild(newMessage);
        }

    }
    this.appendAuth = function (confirmCallBack) {
        if (typeof confirmCallBack == "undefined")
            confirmCallBack = function (name, password) { };
        // append Body
        var newAuth = appendBody("A", authColor, 0);
        var content = newAuth.querySelector(".content");
        content.innerHTML = authCoreHtml;
        var nameInput = content.querySelector("input.name");
        var passInput = content.querySelector("input.pass");
        nameInput.placeholder = nameHolder;
        passInput.placeholder = passHolder;
        // actions 
        passInput.onkeypress = function () {
            if (event.keyCode == "13") {
                container.removeChild(newAuth);
                confirmCallBack(nameInput.value, passInput.value);
            }
        }
        newAuth.querySelector(".info").onclick = function () {
            container.removeChild(newAuth);
            confirmCallBack(nameInput.value, passInput.value);
        }
    }
}

function UploadPart(uploadBox, opts) {
    // parameters ======================//
    if (typeof uploadBox == "string") uploadBox = document.querySelector(uploadBox);
    if (typeof opts == "undefined") opts = {};
    var uploadFileCore = ("uploadFileCore" in opts) ? opts.uploadFileCore : function () { };
    var finishCallBack = ("finishCallBack" in opts) ? opts.finishCallBack : function () { };
    var fontColor = ("fontColor" in opts) ? opts.fontColor : "#555";
    var progColor = ("progColor" in opts) ? opts.progColor : "#dde";

    // html and style ================================//
    {
        var uploadStyle = '\
            .menuBtn {cursor:pointer;display:inline-block;padding:0.6em;font-weight:600;\
                min-width:5em;text-align:center;color:' + fontColor + ';}\
            .item {position:relative;height:2.5em;overflow:hidden;border-bottom:1px solid ' + progColor + ';}\
            .content {overflow:auto;position:absolute;top:1em;right:3em;bottom:3.6em;left:3em;\
                border-radius:0.5em;border:0.2em solid #abc;}\
            .itemList {overflow:auto;position:absolute;top:3em;right:0.5em;left:0.5em;bottom:3em;}\
            .progress {background:' + progColor + ';border-radius:0.2em;}\
            .colLine {position:absolute;top:0;bottom:0;left:0;width:100%;color:#555;}\
            .colItem {float:left;overflow:auto;padding:0.7em 1%;white-space:nowrap;cursor:pointer;}';

        var uploadHtml = '<div class="content">\
            <div style="overflow:hidden;"><div class="menuBtn reset" style="float:right;">reset</div>\
            <div class="menuBtn info">upload 0 / 0</div></div>\
            <div class="itemList"></div>\
            <div class="menuBtn confirm" style="position:absolute;right:1em;bottom:0em;">confirm</div></div>';

        var itemHtml = '<div class="item"><div class="colLine"><div class="progress colLine"></div><div class="colLine"><div class="item0 colItem"></div><div class="item1 colItem"></div><div class="item2 colItem"></div></div></div>';
    }
    insertStyleHtml(uploadStyle, uploadHtml, uploadBox);

    // locals ======================================//
    var currentDirLink = "";
    var fileInputs = document.createElement('div');
    var onUpload = false, finishUpload = false, uploadFinished = 0;

    var resetBtn = uploadBox.querySelector(".reset");
    var infoBtn = uploadBox.querySelector(".info");
    var listTable = uploadBox.querySelector(".itemList");
    var confirmBtn = uploadBox.querySelector(".confirm");

    resetBtn.click(); // as init

    resetBtn.onclick = function () {
        onUpload = false, finishUpload = false, uploadFinished = 0;
        fileInputs.innerHTML = '';
        listTable.innerHTML = '';
        infoBtn.innerText = "upload 0/0";
    }
    infoBtn.onclick = function () {
        if (onUpload) return;
        if (finishUpload) resetBtn.click();
        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = "multiple";
        fileInputs.appendChild(fileInput);
        fileInput.onchange = function () {
            var files = this.files;
            for (var i = 0; i < files.length; i++) {
                appendUploadItem(files[i]);
            }
            setUploadInfo();
        }
        fileInput.click();
    }
    confirmBtn.onclick = function () {
        // uploadFileCore = function (file, dirLink, callback) { }
        if (onUpload || finishUpload) return;
        onUpload = true, finishUpload = false;
        uploadFiles(0, listTable.children, function (file, callback) {
            uploadFileCore(file, currentDirLink, callback);
        });
    }

    function formatSize(sizeB) {
        // Cautions: >> is limited to 32bit signed int, 1<<31 
        var GB = 1 << 30, MB = 1 << 20, KB = 1 << 10;
        if (sizeB > GB) return (sizeB / GB).toFixed(3) + "G";
        else if (sizeB > MB) return (sizeB / MB).toFixed(3) + "M";
        else if (sizeB > KB) return (sizeB / KB).toFixed(3) + "K";
        else return sizeB.toString() + "B";
    }
    function setUploadInfo() {
        var total = listTable.children.length;
        infoBtn.innerText = "upload " + uploadFinished.toString() + "/" + total.toString();
        if (total != 0 && uploadFinished == total) {
            onUpload = false;
            finishUpload = true;
            finishCallBack();
        }
    }
    function appendUploadItem(file) {
        var itemNode = document.createElement('div');
        itemNode.innerHTML = itemHtml;
        itemNode = itemNode.firstChild;
        var nameEle = itemNode.querySelector('.item0');
        var sizeEle = itemNode.querySelector('.item1');
        var statEle = itemNode.querySelector('.item2');
        var progEle = itemNode.querySelector('.progress');
        nameEle.style.width = "48%";
        sizeEle.style.width = "28%";
        statEle.style.width = "18%";
        progEle.style.width = "0%";
        itemNode.carryFile = file;
        nameEle.innerText = itemNode.carryFile.name;
        sizeEle.innerText = formatSize(itemNode.carryFile.size);
        statEle.innerText = "wait";
        statEle.onclick = function () {
            if (this.innerText == "wait") {
                listTable.removeChild(itemNode);
                setUploadInfo();
            }
        }
        listTable.appendChild(itemNode);
    }
    function uploadFiles(index, nodes, uploadFileCore) {
        if (!nodes.length || index == nodes.length) return;
        uploadFileCore(nodes[index].carryFile, function (progress, status) {
            // set Current Status
            // status: wait / md5 / upload / finish / exist / chunked / fail / authFail 
            percent = (100 * progress).toFixed(2) + "%";
            var progEle = nodes[index].querySelector(".progress");
            var sizeEle = nodes[index].querySelector(".item1");
            var statEle = nodes[index].querySelector(".item2");
            var sizePos = sizeEle.innerText.indexOf("@");
            var filesize = sizeEle.innerText;
            if (sizePos != -1) filesize = filesize.slice(0, sizePos);
            progEle.style.width = percent;
            sizeEle.innerText = filesize + "@" + percent;
            statEle.innerText = status;
            switch (status.trim()) {
                case "finish":
                    uploadFinished += 1;
                    setUploadInfo();
                    uploadFiles(index + 1, nodes, uploadFileCore);
                    break;
                case "chunked": case "fail": case "exist":
                    uploadFiles(index + 1, nodes, uploadFileCore);
                    break;
                default: // md5 upload authFail
                    return;
            }
        });
    }

    // methods ================================//
    this.setDirLink = function (dirLink) { currentDirLink = dirLink; }
}

function MovePart(moveBox, opts) {
    // parameters======================//
    if (typeof moveBox == "string") moveBox = document.querySelector(moveBox);
    if (typeof opts == "undefined") opts = {};
    var renameCore = ("renameCore" in opts) ? opts.renameCore : function () { };
    var openFolder = ("openFolder" in opts) ? opts.openFolder : function (link, callback) { };
    var finishCallBack = ("finishCallBack" in opts) ? opts.finishCallBack : function () { };
    var fontColor = ("fontColor" in opts) ? opts.fontColor : "#555";
    var progColor = ("progColor" in opts) ? opts.progColor : "#dde";

    // html and style ===================================//
    {
        var moveStyle = '\
            .menuBtn {cursor:pointer;display:inline-block;padding:0.4em;margin:0.2em;border-radius:0.4em;\
                font-weight:600;min-width:5em;text-align:center;color:' + fontColor + ';}\
            .item {position:relative;height:2.5em;overflow:hidden;border-bottom: 1px solid ' + progColor + ';}\
            .content {position:absolute;top:1em;right:3em;bottom:3.6em;left:3em;overflow:auto;\
                border-radius:0.5em;border:0.2em solid #abc;}\
            .folderList {padding:0.5em 1em;overflow:auto;height:15em;}\
            .folderList .menuBtn {border: 0.1em solid #8bf;}\
            .destFolder {padding:0.5em 1em;font-weight:600;white-space:nowrap;overflow:auto;}\
            .itemList {position:absolute;top:21em;right:0.5em;left:0.5em;bottom:3em;overflow:auto;}\
            .progress {background:' + progColor + ';border-radius:0.2em;}\
            .colLine {position:absolute;top:0;bottom:0;left:0;width:100%;color:#555;}\
            .colItem {float:left;overflow: auto;padding:0.7em 1%;white-space: nowrap;cursor: pointer;}\
            ';

        var moveHtml = '<div class="content">\
            <div style="overflow:hidden;"><div class="menuBtn reset" style="float:right;">reset</div>\
            <div class="destFolder"></div></div><div class="folderList"></div>\
            <div style="padding:0.5em 1em;font-weight:600;">Sources:</div><div class="itemList"></div>\
            <div class="menuBtn confirm" style="position:absolute;right:1em;bottom:0;">confirm</div></div>\
            ';

        var itemHtml = '<div class="item"><div class="colLine"><div class="progress colLine"></div><div class="colLine"><div class="item0 colItem"></div><div class="item1 colItem"></div><div class="item2 colItem"></div></div></div>';
    }
    insertStyleHtml(moveStyle, moveHtml, moveBox);

    // locals ============================================//
    var moveProcList = [], moveDestDirLink = "";
    var onMove = false, finishMove = false;

    var resetBtn = moveBox.querySelector(".reset");
    var dest = moveBox.querySelector(".destFolder");
    var listTable = moveBox.querySelector(".itemList");
    var folderListTable = moveBox.querySelector('.folderList');
    var confirmBtn = moveBox.querySelector(".confirm");

    resetBtn.onclick = function () { initMove(moveProcList, moveDestDirLink); }
    confirmBtn.onclick = function () {
        // moveCore = function (oriLink, newLink, callback) { };
        if (onMove || finishMove) return;
        onMove = true, finishMove = false;
        var nodes = listTable.children;
        for (var i = 0; i < nodes.length; i++) {
            // stop change
            var nameEle = nodes[i].querySelector(".item0");
            var statEle = nodes[i].querySelector(".item2");
            nameEle.setAttribute('contenteditable', 'false');
            statEle.innerText = "wait";
        }
        moves(0, nodes, renameCore);
    }

    function initMove(procList, dirLink) {
        moveProcList = procList;
        moveDestDirLink = dirLink;
        onMove = false, finishMove = false;
        openFolder(moveDestDirLink, updateDirInfo);
        listTable.innerHTML = '';
        for (var i = 0; i < procList.length; i++) {
            appendMoveItem(procList[i]);
        }
    }
    function appendMoveItem(link) {
        var itemNode = document.createElement('div');
        itemNode.innerHTML = itemHtml;
        itemNode = itemNode.firstChild;
        var nameEle = itemNode.querySelector('.item0');
        var sizeEle = itemNode.querySelector('.item1');
        var statEle = itemNode.querySelector('.item2');
        var progEle = itemNode.querySelector('.progress');
        nameEle.style.width = "78%";
        sizeEle.style.display = "none";
        statEle.style.width = "18%";
        progEle.style.width = "0%";
        itemNode.setAttribute('link', link);
        var name = decodeURIComponent(link);
        name = name.slice(name.lastIndexOf("/") + 1);
        nameEle.innerText = name;
        statEle.innerText = "cancel";
        statEle.onclick = function () {
            if (this.innerText == "cancel") listTable.removeChild(itemNode);
        }
        listTable.appendChild(itemNode);
    }
    function updateDirInfo(info) {
        var pathList = info.pathList;
        var folderList = info.folderList;
        folderList.sort(function (a, b) { return a.Name.localeCompare(b.Name) });
        // update info ---------------------------
        var pathText = 'Home';
        for (var i = 1; i < pathList.length; i++) {
            var name = decodeURIComponent(pathList[i]);
            name = name.slice(name.lastIndexOf("/") + 1);
            pathText += '/' + name;
        }
        dest.innerText = "Destination: " + pathText;
        // update folderList ---------------------
        pdirLink = (pathList.length == 1) ? pathList[0] : pathList[pathList.length - 2];
        var folderHtml = '<a class="menuBtn" link = "' + pdirLink + '">..</a>';
        moveDestDirLink = pathList[pathList.length - 1];
        for (var i = 0; i < folderList.length; i++) {
            var name = decodeURIComponent(folderList[i].Name);
            var link = moveDestDirLink + encodeURIComponent("/") + folderList[i].Name;
            folderHtml += '<a class="menuBtn" link = "' + link + '">' + name + '</a>'
        }
        folderListTable.innerHTML = folderHtml;
        var nodes = folderListTable.children;
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].onclick = function () {
                openFolder(this.getAttribute('link'), updateDirInfo);
            }
        }
    }
    function moves(index, nodes, moveCore) {
        if (index >= nodes.length) {
            finishMove = true;
            finishCallBack();
            return;
        }
        var nameEle = nodes[index].querySelector(".item0");
        var statEle = nodes[index].querySelector(".item2");
        var progEle = nodes[index].querySelector(".progress");
        var oriLink = nodes[index].getAttribute('link');
        var newLink = moveDestDirLink + encodeURIComponent("/" + nameEle.innerText);
        if (oriLink == newLink) {
            statEle.innerText = "exist";
            progEle.style.width = "100%";
            moves(index + 1, nodes, moveCore);
        } else {
            moveCore(oriLink, newLink, function (status) {
                statEle.innerText = status;
                progEle.style.width = "100%";
                moves(index + 1, nodes, moveCore);
            });
        }
    }

    // methods ====================================//
    this.init = initMove;
}

// main viewer using all above =============//
function FileViewer(viewBox, opts) {
    // parameters ============================================//
    if (typeof viewBox == "string") viewBox = document.querySelector(viewBox);
    if (typeof opts == "undefined") opts = {};
    var backColor = ("backColor" in opts) ? opts.backColor : "#fff";
    var refresh = ("refresh" in opts) ? opts.refresh : function () { };
    var adminCore = ("adminCore" in opts) ? opts.adminCore : null;
    var popupZIndex = ("popupZIndex" in opts) ? opts.popupZIndex : 1;

    var signColor = "#888", monitorColor = "#fa9", uploadColor = "#9e9", mkdirColor = "#dd9";
    var renameColor = "#9ec", moveColor = "#9de", removeColor = "#d9e", logoutColor = "#8ae";

    // html and style ===========================================// 
    { // icons
        var exitIcon = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTcgMTciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9InNpLWdseXBoIHNpLWdseXBoLWRlbGV0ZSI+PHBhdGggZD0iTTEyLjU2NiA4bDMuMDQ1LTMuMDQ0Yy40Mi0uNDIxLjQyLTEuMTAzIDAtMS41MjJMMTIuNTY2LjM4OWExLjA3OCAxLjA3OCAwIDAgMC0xLjUyMyAwTDcuOTk5IDMuNDMzIDQuOTU1LjM4OWExLjA3OCAxLjA3OCAwIDAgMC0xLjUyMyAwTC4zODggMy40MzRhMS4wNzQgMS4wNzQgMCAwIDAtLjAwMSAxLjUyMkwzLjQzMSA4IC4zODcgMTEuMDQ0YTEuMDc1IDEuMDc1IDAgMCAwIC4wMDEgMS41MjNsMy4wNDQgMy4wNDRjLjQyLjQyMSAxLjEwMi40MjEgMS41MjMgMGwzLjA0NC0zLjA0NCAzLjA0NCAzLjA0NGExLjA3NiAxLjA3NiAwIDAgMCAxLjUyMyAwbDMuMDQ1LTMuMDQ0Yy40Mi0uNDIxLjQyLTEuMTAzIDAtMS41MjNMMTIuNTY2IDh6IiBmaWxsPSIjNDM0MzQzIiBjbGFzcz0ic2ktZ2x5cGgtZmlsbCIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+";

        var downIcon = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9InNpLWdseXBoIHNpLWdseXBoLWVuZC1wYWdlIj48ZyBmaWxsPSIjNDM0MzQzIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik04LjMyNyAxMS44ODZsNC40NDctNC45NGEuNjUuNjUgMCAwIDAtLjAwMi0uODQ5bC0yLjg0MS0uMDA1VjEuMDY4YzAtLjU1My0uNDM3LTEtLjk3Ni0xSDcuMDA0YS45ODcuOTg3IDAgMCAwLS45NzYgMXY1LjAybC0yLjk1LS4wMDVhLjY1Mi42NTIgMCAwIDAgLjAwNC44NDhsNC40ODUgNC45NTRhLjUwMS41MDEgMCAwIDAgLjc2LjAwMXpNMTMuOTE4IDE0LjgzNGMwIC41NTItLjQzNyAxLS45NzMgMUgzLjA1NmMtLjUzNyAwLS45NzMtLjQ0OC0uOTczLTFWMTRjMC0uNTUyLjQzNi0xIC45NzMtMWg5Ljg4OWMuNTM2IDAgLjk3My40NDguOTczIDF2LjgzNHoiIGNsYXNzPSJzaS1nbHlwaC1maWxsIi8+PC9nPjwvc3ZnPg==";

        var prevIcon = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTcgMTciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9InNpLWdseXBoIHNpLWdseXBoLXRyaWFuZ2xlLWxlZnQiPjxwYXRoIGQ9Ik0zLjQ0NiAxMC4wNTJhMS40OSAxLjQ5IDAgMCAxIDAtMi4xMDRMOS44OSAxLjUwNmMuNTgxLS41ODIgMi4xMDMtLjgzOSAyLjEwMyAxdjEyLjk4OGMwIDEuOTAxLTEuNTIxIDEuNTgyLTIuMTAzIDEuMDAxbC02LjQ0NC02LjQ0M3oiIGZpbGw9IiM0MzQzNDMiIGNsYXNzPSJzaS1nbHlwaC1maWxsIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=";

        var nextIcon = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTcgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9InNpLWdseXBoIHNpLWdseXBoLXRyaWFuZ2xlLXJpZ2h0Ij48cGF0aCBkPSJNNi4xMTMgMTUuNDk1Yy0uNTgyLjU4MS0yLjEwMy45LTIuMTAzLTEuMDAxVjEuNTA2YzAtMS44MzkgMS41MjEtMS41ODIgMi4xMDMtMWw2LjQ0NCA2LjQ0MmExLjQ5IDEuNDkgMCAwIDEgMCAyLjEwNGwtNi40NDQgNi40NDN6IiBmaWxsPSIjNDM0MzQzIiBjbGFzcz0ic2ktZ2x5cGgtZmlsbCIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+";
    }
    { // idHtml
        var headerHtml = '\
            <div class="ctrlBtn" style="float:right;display:flex;">\
            <div class="prevBtn" style="padding:1em;font-size:1em;cursor:pointer;float:left;">\
            <img style="width:1em;height:1em;" src="' + prevIcon + '"/></div>\
            <div class="nextBtn" style="padding:1em;font-size:1em;cursor:pointer;float:right;">\
            <img style="width:1em;height:1em;" src="' + nextIcon + '"/></div>\
            <a class="downBtn" style="display:block;padding:1em;font-size:1em;cursor:pointer;">\
            <img style="width:1em;height:1em;" src="' + downIcon + '"/></a>\
            <div class="exitBtn" style="padding:1em;font-size:1em;cursor:pointer;">\
            <img style="width:1em;height:1em;" src="' + exitIcon + '"/></div>\
            </div>\
            <div class="title" style="overflow:auto;font-size:1.1em;padding:0.7em;\
            white-space: nowrap;font-weight:600;color:#000;"></div>';

        var viewHtml = '\
            <div class="container" style="background:'+ backColor + ';top:0;right:0;bottom:0;left:0;position:absolute;font-size:14px;display:none;">\
            <div class="header" style="position:absolute;top:0;right:0;left:0;">' + headerHtml + '</div>\
            <div class="content" style="position:absolute;top:3em;right:0;bottom:0;left:0;\
            overflow:hidden;"></div>\
            </div>\
            ';
        
        var musicHtml = '<div class="museBar" style="position:absolute;right:0;bottom:0;left:0;display:none;"></div>';

        var menuStyle = 'cursor:pointer;display:inline-block;padding: 0.3em;margin:0.2em;min-width:5em;font-weight:600;text-align:center;color:' + backColor + ';';

        var menuHtml = '<div class="menuBar" style="position:absolute;right:0;bottom:0;left:0;\
            padding:0.4em;display:none;background:' + backColor + ';">\
            <a class="logout" style="display:none;float:right;'+ menuStyle + 'background:' + logoutColor + ';">logout</a>\
            <div style="white-space:nowrap;overflow:auto;">\
            <a class="sign" style="'+ menuStyle + 'background:' + signColor + ';">pages</a>\
            <a class="monitor" style="'+ menuStyle + 'background:' + monitorColor + ';">monitor</a>\
            <a class="mkdir" style="'+ menuStyle + 'background:' + mkdirColor + ';">mkdir</a>\
            <a class="upload" style="'+ menuStyle + 'background:' + uploadColor + ';">upload</a>\
            <a class="rename" style="'+ menuStyle + 'background:' + renameColor + ';">rename</a>\
            <a class="move" style="'+ menuStyle + 'background:' + moveColor + ';">move</a>\
            <a class="remove" style="'+ menuStyle + 'background:' + removeColor + ';">remove</a>\
            </div></div>';

        var popupHtml = '<div class="popupBox" style="position:fixed;top:10%;left:50%;transform:translate(-50%,0);z-index:' + popupZIndex + ';"></div>';
    }
    viewBox.innerHTML = viewHtml + musicHtml + menuHtml + popupHtml;

    // locals =================================//
    var linkList = [];

    var container = viewBox.querySelector(".container");
    var museBar = viewBox.querySelector(".museBar");
    var menuBar = viewBox.querySelector(".menuBar");
    var popupBox = viewBox.querySelector(".popupBox");

    var header = container.querySelector(".header");
    var content = container.querySelector(".content");
    var title = header.querySelector(".title");
    var exitBtn = header.querySelector(".exitBtn");
    var downBtn = header.querySelector(".downBtn");
    var prevBtn = header.querySelector(".prevBtn");
    var nextBtn = header.querySelector(".nextBtn");

    var logoutBtn = menuBar.querySelector('.logout');
    var signBtn = menuBar.querySelector('.sign');
    var monitorBtn = menuBar.querySelector('.monitor');
    var uploadBtn = menuBar.querySelector('.upload');
    var mkdirBtn = menuBar.querySelector('.mkdir');
    var renameBtn = menuBar.querySelector('.rename');
    var removeBtn = menuBar.querySelector('.remove');
    var moveBtn = menuBar.querySelector('.move');

    var codeBox = document.createElement('div');
    var videoBox = document.createElement('div');
    var monitorBox = document.createElement('div');
    var uploadBox = document.createElement('div');
    var moveBox = document.createElement('div');

    codeBox.style = "width:100%; height:100%";
    videoBox.style = "width:100%; height:100%";
    monitorBox.style = "width:100%; height:100%";
    uploadBox.style = "width:100%; height:100%";
    moveBox.style = "width:100%; height:100%";

    var codeView = new CodeView(codeBox);
    var popupMenu = new PopupMenu(popupBox);
    var musicPlayer = new MediaPlayer(museBar, { stopCallBack: closeView });
    var videoPlayer = new VideoPlayer(videoBox, { stopCallBack: closeView });
    var monitor = new MonitorFront(monitorBox, { "getMonitor": adminCore.getMonitor });
    var uploader = new UploadPart(uploadBox,
        { "finishCallBack": refresh, "uploadFileCore": adminCore.uploadFile });
    var mover = new MovePart(moveBox,
        { "finishCallBack": refresh, "renameCore": adminCore.renameCore, "openFolder": adminCore.openFolder });

    checkAuthStat(3000);

    function setTitle(link) {
        var titleText = decodeURIComponent(link);
        titleText = titleText.slice(titleText.lastIndexOf("/") + 1).trim();
        title.innerText = (titleText == "") ? "home" : titleText;
    }
    // open file ===================================//
    var viewType = {
        "pdf": [".pdf"],
        "markdown": [".md", ".MD"],
        "html": [".html", ".xhtml", ".shtml", ".htm", ".url", ".xml"],
        "text": [".py", ".js", ".json", ".php", ".phtml", ".h", ".c", ".hpp", ".cpp", ".class", ".jar", ".java", ".css", ".sass", ".scss", ".less", ".xml", ".bat", ".BAT", ".cmd", ".sh", ".ps", ".m", ".go", ".txt", ".cnf", ".conf", ".map", ".yaml", ".ini", ".nfo", ".info", ".log"],
        "image": [".bmp", ".png", ".tiff", ".tif", ".gif", ".jpg", ".jpeg", ".jpe", ".psd", ".ai", ".ico", ".webp", ".svg", ".svgz", ".jfif"],
        "audio": [".aac", ".aif", ".aifc", ".aiff", ".ape", ".au", ".flac", ".iff", ".m4a", ".mid", ".mp3", ".mpa", ".ra", ".wav", ".wma", ".f4a", ".f4b", ".oga", ".ogg", ".xm", ".it", ".s3m", ".mod"],
        "video": [".asf", ".asx", ".avi", ".flv", ".mkv", ".mov", ".mp4", ".mpg", ".rm", ".srt", ".swf", ".vob", ".wmv", ".m4v", ".f4v", ".f4p", ".ogv", ".webm"]
    }

    function closeView() {
        try {
            content.innerHTML = "";
            container.style.display = "none";
            museBar.style.display = "none";
            prevBtn.style.display = "";
            nextBtn.style.display = "";
            downBtn.style.display = "";
        } catch (err) { }
    }

    function chooseType(name) {
        var suffix = name.slice(name.lastIndexOf("."));
        for (var type in viewType) {
            if (viewType[type].includes(suffix)) return type;
        }
        return "default";
    }

    function supportPDF() {
        return false;
    }

    function playMusic(link) {
        museBar.style.display = "";
        if (musicPlayer.thisPos(link) != linkList.indexOf(link))
            musicPlayer.setPlayList(linkList);
        musicPlayer.playThis(link);
    }

    function playVideo(link) {
        content.appendChild(videoBox);
        container.style.display = "";
        videoPlayer.setPlayList([link]);
        videoPlayer.playThis(link);
    }

    function showCode(link) {
        content.appendChild(codeBox);
        container.style.display = "";
        codeView.showCode(link);
    }

    function showHtml(link) {
        pageHtml = '<iframe src="' + link + '" frameborder=0 style="height:100%;width:100%;"/>';
        content.innerHTML = '<div style="width:100%;height:100%;">' + pageHtml + '</div>'
        container.style.display = "";
    }

    function showMark(link) {
        content.appendChild(codeBox);
        container.style.display = "";
        codeView.showMark(link);
    }

    function showImage(link) {
        content.innerHTML = '<div style="text-align:center;width:100%; height:95%;"><img src="' + link + '" style="max-width:100%;max-height:100%;"></img></div>';
        container.style.display = "";
    }

    function showPdf(link) {
        // use embed
        var pdfHtml = '<embed src="' + link + '" style="overflow:auto;height:100%;width:100%;"/>';
        if (!supportPDF()) {
            // use pdfjs
            var viewerHtmlURL = "./outLibs/pdfjs/web/viewer.html";
            pdfHtml = '<iframe src="' + viewerHtmlURL + '?file=' + encodeURIComponent(link) + '"  frameborder=0 style="height:100%;width:100%;"/>';
        }
        content.innerHTML = '<div style="width:100%;height:100%;">' + pdfHtml + '</div>'
        container.style.display = "";
    }

    function showPlain(link) {
        content.innerHTML = '<div style="text-align:center;width:100%; height:95%;font-size:1.2em;padding:1em;"><br><br>binary file<br><br><a href="' + link + '">' + link + '<a></div>';
        container.style.display = "";
    }

    function openFile(link) {
        try {
            closeView();
            setTitle(link);
            downBtn.href = link;
            switch (chooseType(link)) {
                case "pdf": showPdf(link); break;
                case "markdown": showMark(link); break;
                case "html": showHtml(link); break;
                case "text": showCode(link); break;
                case "image": showImage(link); break;
                case "audio": playMusic(link); break;
                case "video": playVideo(link); break;
                default: showPlain(link); break;
            }
            exitBtn.onclick = function () { closeView(); musicPlayer.playStop(); videoPlayer.playStop(); }
            downBtn.onclick = function () { adminCore.download(link); return false; }
            prevBtn.onclick = function () {
                var pos = linkList.indexOf(link);
                if (pos == -1) return;
                if (pos == 0) pos = linkList.length - 1;
                else pos = pos - 1;
                openFile(linkList[pos]);
            }
            nextBtn.onclick = function () {
                var pos = linkList.indexOf(link);
                if (pos == -1) return;
                if (pos == linkList.length - 1) pos = 0;
                else pos = pos + 1;
                openFile(linkList[pos]);
            }

        } catch (e) { console.log(e); }
    }

    // open menu =================================================//
    function resetMenu() {
        try {
            content.innerHTML = "";
            container.style.display = "none";
            prevBtn.style.display = "none";
            nextBtn.style.display = "none";
            downBtn.style.display = "none";
            monitor.close();
            uploadBox.querySelector(".reset").click();
            moveBox.querySelector(".reset").click();
            menuBar.style.display = "none";
        } catch (err) { }
    }

    function checkAuthStat(waitTime) {
        if (adminCore.getAuthStat()) logoutBtn.style.display = "";
        else logoutBtn.style.display = "none";
        setTimeout(function () { checkAuthStat(waitTime); }, waitTime);
    }

    function askAuth(targetLink, passCallBack) {
        popupMenu.appendAuth(function (name, key) {
            if (!key) return false;
            adminCore.askAuthCore(key, targetLink, function () {
                logoutBtn.style.display = "";
                if (typeof passCallBack != "undefined") passCallBack();
            }, function (result) {
                popupMenu.appendMessage("fail", "Authorization Fail");
            });
        });
    }

    function closeSession(targetLink) {
        if (logoutBtn.style.display == "none") return;
        popupMenu.appendMessage("confirm", "Are you sure to log out?", function () {
            adminCore.closeSessionCore(targetLink, function () { logoutBtn.style.display = "none"; });
        });
    }

    function showMonitor() {
        setTitle("monitor");
        content.appendChild(monitorBox);
        container.style.display = "";
        monitor.open();
    }

    function mkdir(link) {
        if (logoutBtn.style.display == "none")
            return askAuth(link, function () { mkdir(link) });
        popupMenu.appendMessage("input", { "input": "", "message": "New Directory" }, function (name) {
            adminCore.mkdirCore(link + encodeURIComponent("/" + name), function (result) {
                refresh();
                switch (result.trim()) {
                    case "fail": case "authFail":
                        popupMenu.appendMessage("fail", "mkdir " + name + " : " + result, "");
                        break;
                    case "exist":
                        popupMenu.appendMessage("warn", "mkdir " + name + " : exist", "");
                        break;
                    default: // "pass"
                        popupMenu.appendMessage("pass", "mkdir " + name + " : pass", "");
                }
            });
        });
    }

    function upload(link) {
        setTitle("upload files");
        if (logoutBtn.style.display == "none")
            return askAuth(link, function () { upload(link) });
        content.appendChild(uploadBox);
        container.style.display = "";
        uploader.setDirLink(link);
    }

    function rename(link) {
        if (logoutBtn.style.display == "none")
            return askAuth(link, function () { rename(link) });
        var oriName = decodeURIComponent(link);
        oriName = oriName.slice(oriName.lastIndexOf("/") + 1);
        var dirLink = link.slice(0, link.lastIndexOf(encodeURIComponent("/" + oriName)));
        popupMenu.appendMessage("input", { "input": oriName, "message": "rename " + oriName }, function (newName) {
            adminCore.renameCore(link, dirLink + encodeURIComponent("/" + newName), function (result) {
                refresh();
                switch (result.trim()) {
                    case "fail": case "authFail":
                        popupMenu.appendMessage("fail", "rename " + newName + " : " + result, "");
                        break;
                    case "exist":
                        popupMenu.appendMessage("warn", "rename " + newName + " : exist", "");
                        break;
                    default: // "pass"
                        popupMenu.appendMessage("pass", "rename " + newName + " : pass", "");
                }
            });
        });
    }

    function remove(linkList) {
        if (logoutBtn.style.display == "none")
            return askAuth(linkList[0], function () { remove(linkList) });
        popupMenu.appendMessage("confirm", { "message": "remove " + linkList.length + " items ?" }, function () {
            function removes(index, linkList) {
                if (index >= linkList.length) {
                    refresh();
                    popupMenu.appendMessage("pass", "removed " + index + "items", "");
                    return;
                }
                var link = linkList[index];
                adminCore.removeCore(link, function (result) {
                    switch (result.trim()) {
                        case "fail": case "authFail":
                            refresh();
                            popupMenu.appendMessage("warn", "removed " + index + "items", "");
                            break;
                        case "exist":
                            refresh();
                            var name = decodeURIComponent(link);
                            name = name.slice(name.lastIndexOf("/") + 1);
                            popupMenu.appendMessage("warn", name + " : exist in trash", "");
                            break;
                        default: // "pass"
                            removes(index + 1, linkList);
                    }
                });
            }
            removes(0, linkList);
        });
    }

    function move(linkList, dirLink) {
        setTitle("move to");
        if (logoutBtn.style.display == "none")
            return askAuth(dirLink, function () { move(linkList, dirLink) });
        content.appendChild(moveBox);
        container.style.display = "";
        mover.init(linkList, dirLink);
    }

    function openMenu(dirLink, procList, sign) {
        // sign: item, page
        try {
            if (sign == "page" && menuBar.style.display != "none") {
                menuBar.style.display = "none";
            } else {
                resetMenu();
                menuBar.style.display = (sign == "item" && procList.length == 0)? "none" : "";
            }

            exitBtn.onclick = function () { resetMenu(); }
            logoutBtn.onclick = function () { resetMenu(); closeSession(dirLink); }

            if (sign == "item"){
                monitorBtn.style.display = "none";
                mkdirBtn.style.display = "none";
                uploadBtn.style.display = "none";
                renameBtn.style.display = (procList.length == 1)? "inline-block" : "none";
                removeBtn.style.display = "inline-block";
                moveBtn.style.display = "inline-block";
                signBtn.innerText = 'items: ' + procList.length;
                renameBtn.onclick = function () { resetMenu(); rename(procList[0]); }
                removeBtn.onclick = function () { resetMenu(); remove(procList); }
                moveBtn.onclick = function () { resetMenu(); move(procList, dirLink); }
            } else {
                monitorBtn.style.display = "inline-block";
                mkdirBtn.style.display = "inline-block";
                uploadBtn.style.display = "inline-block";
                renameBtn.style.display = "none";
                removeBtn.style.display = "none";
                moveBtn.style.display = "none";
                signBtn.innerText = 'pages';
                monitorBtn.onclick = function () { resetMenu(); showMonitor(); }
                mkdirBtn.onclick = function () { resetMenu(); mkdir(dirLink); }
                uploadBtn.onclick = function () { resetMenu(); upload(dirLink); }
                signBtn.onclick = function (){resetMenu(); setTitle('pages'); showHtml('./pages.html')}
            }

        } catch (err) { }
    }


    // methods ====================================================//
    this.openFile = openFile;
    this.openMenu = openMenu;
    this.closeAll = function () { resetMenu(); closeView(); musicPlayer.playStop(); videoPlayer.playStop(); }
    this.setLinkList = function (list) { linkList = list.slice(0); }
}
