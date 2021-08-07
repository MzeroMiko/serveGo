#! /bin/bash

function _run() {
    name=$1
    action=$2
    check=$3
    cmd_start=$4
    # cmd_pids=$5 # must be like "pids=..."
    # cmd_stop=$6
    cmd_pids="pids=\$(ps aux | grep \"\$check\" | grep -v grep | awk '{print \$2}')"
    cmd_stop="kill \$pids 1>/dev/null 2>&1"
    
    # echo $cmd_start

    eval $cmd_pids
    case "$action" in
        start)
            if [ "$pids" == "" ]; then eval $cmd_start; eval $cmd_pids; fi
            echo "$name starts at $pids"
            ;;
        stop)
            eval $cmd_stop
            echo "$name stops at $pids"
            ;;
        status)
            eval $cmd_pids
            echo "$name runs on $pids"
            ;;
        restart)
            eval $cmd_stop; eval $cmd_start; eval $cmd_pids
            echo "$name restarts at $pids"
            ;;
        *)
            eval $cmd_pids
            echo "$name runs on $pids"
            ;;
    esac
}

function _xvfb() {
    ## consts --------------------
    dir=$1
    action=$2
    name="Xvfb"
    check="Xvfb"
    # -----------------
    disp=$3
    resolution=$4
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="nohup Xvfb $disp -ac -screen 0 $resolution > /dev/null 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

function _x11vnc() {
    ## consts --------------------
    dir=$1
    action=$2
    name="x11vnc"
    check="x11vnc"
    # ------------------
    disp=$3
    vncport=$4
    passwd=$5
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="nohup x11vnc -forever -noxdamage -shared -listen 0.0.0.0 -rfbport $vncport -passwd $passwd -display $disp > /dev/null 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

function _novnc() {
    ## consts --------------------
    dir=$1
    action=$2
    name="novnc"
    check="$dir/noVnc/utils/novnc_proxy"
    # ----------------------
    vncport=$3
    novncport=$4
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="cd $dir/noVnc && nohup $dir/noVnc/utils/novnc_proxy --listen $novncport --vnc 0.0.0.0:$vncport  > /dev/null 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

function _lxqt() {
    ## consts --------------------
    dir=$1
    action=$2
    name="lxqt"
    check="lxqt-session"
    # ---------------------
    disp=$3
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="DISPLAY=$disp nohup startlxqt > $dir/lxqt.log 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

dir=$(dirname $(readlink -f $0))
action=$1

source $dir/novnc.conf

# echo $disp && exit

_xvfb "$dir" "$action" "$disp" "$resolution" 
_x11vnc "$dir" "$action" "$disp" "$vncport" "$passwd"
_novnc "$dir" "$action" "$vncport" "$novncport"
sleep 1 && _lxqt "$dir" "$action" "$disp" && exit 0
