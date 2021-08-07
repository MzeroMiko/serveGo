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

function _aria2() {
    ## consts --------------------
    dir=$1
    action=$2
    name="aria2"
    check="$dir/aria2_1.35.0/aria2c --conf-path=$dir/aria2.conf"
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="cd $dir && nohup $dir/aria2_1.35.0/aria2c --conf-path=$dir/aria2.conf >> $dir/aria2.log 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

function _simp() {
    ## consts --------------------
    dir=$1
    action=$2
    name="simp_ariang"
    check="$dir/simp"
    ## runnable variables (use \ !!!) ----------------------
    cmd_start="nohup $dir/simp $dir/simp.json >> $dir/simp.log 2>&1 &"
    ## running ---------------------
    _run "$name" "$action" "$check" "$cmd_start" 
}

dir=$(dirname $(readlink -f $0))
action=$1
_aria2 "$dir" "$action" && _simp "$dir" "$action" && exit 0
