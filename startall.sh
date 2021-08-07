#! /bin/bash

function mount_check() {
    mounts="/media/Data /media/Data2 /media/PriSync"
    for m in $mounts; do
        if [ "$(cat /proc/mounts | awk '{print $2}' | grep -w $m)" == "" ]; then
            echo \"$m\" not mounted
            echo "Please Mount $mounts first."
            exit
        fi
    done
}

# sudo mount /dev/sda1 /media/Data
# sudo mount /dev/sdb1 /media/Data2
# sudo mount /dev/sdc3 /media/PriSync
mount_check

dir=$(dirname $(readlink -f $0))
action=$1
$dir/ariang/startaria2.sh $action
$dir/code/startcode.sh $action
$dir/mikogo/startmikogo.sh $action
$dir/ngrok/startngrok.sh $action
$dir/novnc/startvnc.sh $action
$dir/trweb/starttr.sh $action
exit 0

