
docker rm ubuntu

docker pull --platform=linux/amd64 ubuntu:24.10

cd /opt/git/repo/world-peace/docker/puppeteer;
#docker run -it --name ubuntu-test ubuntu:22.04 /bin/sh
docker run -it --rm --name ubuntu-test --hostname ubuntu-test -w /app ubuntu:22.04 #--network host
cd /opt/git/repo/world-peace/docker/puppeteer && docker cp . ubuntu-test:/app


docker exec -it ubuntu /bin/bash


 apt-get update && apt install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libatk-bridge2.0-0 \
  ibasound2t64 \
  libasound2 \   # ubuntu 24.10 之后： libasound2t64
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  wget \
  libgbm-dev \
  libxshmfence1 \
  libgtk-3-0

  apt-get update && apt-get install -y libasound2 libatk-bridge2.0-0 libcups2 libgbm-dev libxkbcommon-x11-0

# ubuntu 24.10 之后： libasound2t64
apt install -y libasound2t64



# https://hub.docker.com/r/mcp/puppeteer
docker run -it --rm --name puppeteer-example -p 9222:9222 mcp/puppeteer
