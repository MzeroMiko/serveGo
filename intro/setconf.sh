#! /bin/bash

function _release() {
    dir=$1 
    confs=$2

    set -x
    cp $confs/aria2.conf        $dir/../ariang/aria2.conf                   -p
    cp $confs/aria2_simp.json   $dir/../ariang/simp.json                    -p
    cp $confs/code.yml          $dir/../code/code.yml                       -p
    cp $confs/mikogo.json       $dir/../mikogo/mikogo.json                  -p
    cp $confs/ngrok.yml         $dir/../ngrok/ngrok.yml                     -p
    cp $confs/novnc.conf        $dir/../novnc/novnc.conf                    -p
    cp $confs/transmission.json $dir/../trweb/transmission/settings.json    -p
}

function _gather() {
    dir=$1 
    confs=$2
    
    set -x
    cp $dir/../ariang/aria2.conf                $confs/aria2.conf           -p
    cp $dir/../ariang/simp.json                 $confs/aria2_simp.json      -p 
    cp $dir/../code/code.yml                    $confs/code.yml             -p
    cp $dir/../mikogo/mikogo.json               $confs/mikogo.json          -p
    cp $dir/../ngrok/ngrok.yml                  $confs/ngrok.yml            -p
    cp $dir/../novnc/novnc.conf                 $confs/novnc.conf           -p
    cp $dir/../trweb/transmission/settings.json $confs/transmission.json    -p
}

dir=$(dirname $(readlink -f $0))
action=$1

if [ "$action" == "gather" ]; then 
    _gather "$dir" "$dir/confs/$action"
else 
    _release "$dir" "$dir/confs/$action"
fi


