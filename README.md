
puppeteer-mcp-server
---

This is a MCP server that uses Puppeteer to capture web pages and provide command execution.

## 运行
1. docker 方式启动  
`startup.sh`
2. 本地方式启动（推荐先创建虚拟环境，参考下面的运行环境步骤）  
`python start-mcp-server.py streamable-http`
3. 访问方式
 - 3.1 直接访问 http://0.0.0.0:8000/test/mcp_call_tester.html  （推荐) 
 - 3.2 通过curl命令远程调用mcp tools
```shell
# htpp头必须包含 application/json

# mcp list: list all tools
curl -i -X POST http://localhost:8000/mcp/ \
-H "Content-Type: application/json" \
-H "Accept: application/json, text/event-stream" \
-d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"progressToken":2}}}'

# mcp call: run_cmd (在mcp server所在机器上执行命令，支持任何shell命令，注意安全风险)
curl -i -X POST http://localhost:8000/mcp/ \
-H "Content-Type: application/json" \
-H "Accept: application/json, text/event-stream" \
-d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name": "run_cmd", "arguments": { "command": "echo \"Hello from MCP Server\"" }, "_meta":{"progressToken":2}}}'
```

## 目录结构 todo

## local test puppeteer 
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
3. 通过mcpInspector远程调用mcp tools
```shell
# 利用mcpInspector启动访问mcp server
# 先启动/Users/jupiter/15.node-wkspc/mcpInspector, 然后执行:
curl -X POST http://127.0.0.1:5000/api/v1/mcp/run -d '{"url": "https://www.sina.com.cn/", "timeout": 10, "screenshot": true, "screenshot_path": "sina_world.png"}'
curl -X POST http://localhost:8000 --data "url=https://www.qq.com" 
📸 页面截图已保存为 images/20250615071725842_www.qq.com.png
```
4. 测试sina_world_mobile.js
```shell
jupiter@Jupiter-Mac puppeteer$node sina_world_mobile.js 
✅ 环球板块加载成功
📊 抓取结果: []
📸 页面截图已保存为 sina_world.png
```
