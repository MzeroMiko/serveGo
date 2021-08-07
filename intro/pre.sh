#! /bin/bash

id=$( awk -F'=' '/^ID=/{ print $NF }' /etc/os-release )
name=$( awk -F'=' '/^VERSION_CODENAME=/{ print $NF }' /etc/os-release )
echo $id $name 

if [ "$id $name" == "ubuntu focal" -o "$id $name" == "linuxmint ulyssa" ] ; then
    ## for ubuntu 20.04 focal
    sources=./sources_focal.list
    sources_jellyfin="deb [arch=$( dpkg --print-architecture )] https://repo.jellyfin.org/ubuntu focal main"
elif [ "$id $name" == "debian buster" ]; then
    ## for debian 10 buster
    sources=./sources_buster.list
    sources_jellyfin="deb [arch=$( dpkg --print-architecture )] https://repo.jellyfin.org/debian buster main"
else
    echo $id $name do not known
fi

echo $sources $sources_jellyfin


set -x
# Step 0 : change sources
sudo apt update
sudo apt install apt-transport-https ca-certificates
sudo mv /etc/apt/sources.list /etc/apt/sources.list.d/sources.list.bak
cat $sources | sudo tee /etc/apt/sources.list
sudo apt update

# Step 1 : get ssh server and device ip
sudo apt install openssh-server 
sudo systemctl start ssh.service
ip addr

## after Step 1, you can ssh to it

# Step 2 : install common packages 
sudo apt install cockpit
sudo systemctl start cockpit.service

sudo apt install transmission-daemon
sudo systemctl stop transmission-daemon.service
sudo systemctl disable transmission-daemon.service

sudo apt install xvfb x11vnc
sudo apt install openssh-sftp-server openssh-client
sudo apt install nano vim wget htop net-tools bash-completion
sudo apt install smplayer synaptic gparted deborphan samba

# Step 3 : install jellyfin, upload files run startall.sh 
wget -O - https://repo.jellyfin.org/jellyfin_team.gpg.key | sudo apt-key add -
echo $sources_jellyfin | sudo tee /etc/apt/sources.list.d/jellyfin.list
sudo apt update
sudo apt install jellyfin
sudo systemctl start jellyfin.service

sudo apt purge libreoffice* thunderbird* xsane*
sudo apt autoremove
# apt upgrade
