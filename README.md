
# puppeteer-mcp-server

```shell
jupiter@Jupiter-Mac puppeteer$node sina_world_mobile.js 
✅ 环球板块加载成功
📊 抓取结果: []
📸 页面截图已保存为 sina_world.png
```

## 运行环境
1. 创建python虚拟环境
```shell
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# pip freeze > requirements.txt
```
2. 安装node.js和puppeteer
```shell
npm install puppeteer
```
2. python启动mcp server
```shell
python start-mcp-server.py streamable-http # 选择启动方式
```
3. 远程调用mcp tools
```shell
# 选启动/Users/jupiter/15.node-wkspc/mcpInspector
curl -X POST http://127.0.0.1:5000/api/v1/mcp/run -d '{"url": "https://www.sina.com.cn/", "timeout": 10, "screenshot": true, "screenshot_path": "sina_world.png"}'
jupiter@Jupiter-Mac ~$curl -X POST http://localhost:8080 --data "url=https://www.qq.com" 
📸 页面截图已保存为 images/20250615071725842_www.qq.com.png
```



