# 使用带 Java 运行环境的基础镜像（你可以换成具体的 jre 镜像）
FROM ubuntu:22.04

# 避免交互安装提示
ENV DEBIAN_FRONTEND=noninteractive

# 安装依赖包
# ubuntu 24.10 之后: libasound2 -> libasound2t64
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    wget \
    openjdk-11-jre-headless \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
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
    libgbm-dev \
    libxshmfence1 \
    libgtk-3-0 \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# 安装Python 3.11
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y python3.11 python3.11-venv python3.11-dev ca-certificates && \
    python3.11 -m ensurepip && \
    python3.11 -m pip install --upgrade pip && \
    ln -s /usr/bin/python3.11 /usr/bin/python && \
    ln -s /usr/local/bin/pip3.11 /usr/bin/pip

# 安装 Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm

# Keep the browser cache in a stable location and install the browser explicitly
# during image build so runtime containers do not depend on a writable cache
# initialization path.
ENV PUPPETEER_CACHE_DIR=/root/.cache/puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 创建应用目录
WORKDIR /app

# 拷贝代码
COPY . .

# 安装 Puppeteer 和 python 依赖
# RUN pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install -r requirements.txt
RUN npm install
RUN npx puppeteer browsers install chrome

# 入口命令（可根据项目调整）
#CMD ["node", "sina.js"]
EXPOSE 8001
ENTRYPOINT ["python", "start-mcp-server.py"]
CMD ["streamable-http"]
