#docker pull --platform=linux/amd64 ubuntu:22.04
# 1. build
docker build -t puppeteer-mcp:1.0 -f ./Dockerfile .

# 2. run
cd /opt/docker/puppeteer-mcp
docker run \
  --rm \
  --name puppeteer-mcp \
  --hostname puppeteer \
  -v $(pwd)/images:/app/images \
  -v $(pwd)/html:/app/html \
  -p 8000:8000 \
  -w /app \
  --network wp_net \
  --entrypoint python \
  puppeteer-mcp:1.0 start_mcp_server.py streamable-http



  --entrypoint node \

  sina_world_mobile.cjs


docker run --name puppeteer_test -v /Users/jupiter/99.data/6.docker/pupeteer/app:/app -u root --entrypoint "node /app/sina_world_mobile.cjs" mcp/puppeteer:arm64 # sina_world_mobile.cjs
docker run -d -it --name puppeteer_test -v /Users/jupiter/99.data/6.docker/pupeteer/app:/app -u root --entrypoint "/bin/bash" mcp/puppeteer:arm64 # sina_world_mobile.cjs

# 增加运行参数
docker run --name puppeteer_test -v /Users/jupiter/99.data/6.docker/pupeteer/app:/app -u root mcp/puppeteer:arm64 /app/sina_world_mobile.cjs


docker run -d -it --name puppeteer -u root --entrypoint "/bin/bash" mcp/puppeteer:arm64 # create and run container
docker exec -it puppeteer bash # enter the container
node sina_world_mobile.cjs

# docker run -d -it --rm --entrypoint /bin/bash mcp/puppeteer
# docker run -d -it --rm --entrypoint /bin/bash mcp/puppeteer:latest
# docker run -d -it --rm --entrypoint /bin/bash mcp/puppeteer:latest /app/sina_world_mobile.js
