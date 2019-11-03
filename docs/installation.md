List of installation and update commands to set up meguca on Debian buster.
__Use as a reference. Copy paste at your own risk.__
All commands assume to be run by the root user.

## Install

### ArchLinux
```bash
pacman -S git
pacman -S postgresql
pacman -S nodejs npm
pacman -S wget
pacman -S go
# или вручную проверенная версия:
# wget  https://dl.google.com/go/go1.13.linux-amd64.tar.gz
# tar -C /usr/local -xzf go1.13.linux-amd64.tar.gz
# export PATH=$PATH:/usr/local/go/bin
# Чтобы не писать каждый раз export PATH=$PATH:/usr/local/go/bin
# Добавляем в конец ~/.bashrc
# PATH=$PATH:/usr/local/go/bin

pacman -S gcc
pacman -S ffmpeg
pacman -S base-devel pkg-config make
pacman -S opencv hdf5 vtk gtk3 glew qt5-base

# исправление ошибки ReferenceError: primordials is not defined
# необходим даунгрейд ноды
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 10.16.3
nvm use 10.16.3

# в след раз надо в новой сессии перед make выполнить (можно добавить в ~/.bashrc)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 10.16.3

cd /megucapath/
git clone git://github.com/bakape/meguca.git
make

# для сборки строк локализаций
cd /~/go/pkg/mod/github.com/rakyll/statik@v0.1.6
go install
export PATH=$PATH:/root/go/bin
cd /megucapath/
make statik

# для сборки шаблонов
go get -u github.com/valyala/quicktemplate
go get -u github.com/valyala/quicktemplate/qtc
cd /~/go/pkg/mod/github.com/valyala/quicktemplate\@v1.2.0/
go install
#export PATH=$PATH:/root/go/bin
cd /megucapath/
make generate

make
```
```
Исправление проблемы зависимостей. В файле (зависит от версии)
/~/go/pkg/mod/github.com/bakape/captchouli@v1.1.6/thumbnail.go заменяем 
/~/go/pkg/mod/github.com/bakape/captchouli@v1.2.0/thumbnail.go заменяем 
// #cgo pkg-config: opencv
на
// #cgo pkg-config: opencv4
```
```bash

make
```


### Debianbase (original)

```bash
# Install OS dependencies
apt update
apt-get install -y build-essential pkg-config libpth-dev libavcodec-dev libavutil-dev libavformat-dev libswscale-dev libwebp-dev libopencv-dev libgeoip-dev git lsb-release wget curl sudo postgresql
apt-get dist-upgrade -y

# Increase PostgreSQL connection limit by changing `max_connections` to 1024
sed -i "/max_connections =/d" /etc/postgresql/11/main/postgresql.conf
echo max_connections = 1024 >> /etc/postgresql/11/main/postgresql.conf

# Create users and DBS
service postgresql start
su postgres
psql -c "CREATE USER meguca WITH LOGIN PASSWORD 'meguca' CREATEDB"
createdb -T template0 -E UTF8 -O meguca meguca
exit

# Install Go
wget -O- https://dl.google.com/go/go1.13.1.linux-amd64.tar.gz | tar xpz -C /usr/local
echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
source /etc/profile

# Install Node.js
wget -qO- https://deb.nodesource.com/setup_10.x | bash -
apt-get install -y nodejs

# Clone and build meguca
git clone https://github.com/bakape/meguca.git meguca
cd meguca
make

# Edit instance configs
cp docs/config.json .
nano config.json

# Run meguca
./meguca
```

## Update

```bash
cd meguca

# Pull changes
git pull

# Rebuild
make

# Restart running meguca instance.
# This step depends on how your meguca instance is being managed.
#
# A running meguca instance can be gracefully reloaded by sending it the USR2
# signal.
```
