import subprocess
import json

# 启动 Docker 容器
proc = subprocess.Popen(
    # ['docker', 'run', '-i', '--rm', 'mcp/puppeteer:arm64'],
    ['docker', 'run', '-i', '--rm', "--init", "-e", "DOCKER_CONTAINER=true", 'mcp/puppeteer:arm64'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

def send_mcp_request(method, params):
    request = {
        "jsonrpc": "2.0",
        "id": method.split("/")[-1],
        "method": method,
        "params": params
    }
    print("Sending:", json.dumps(request))
    proc.stdin.write(json.dumps(request) + "\n")
    proc.stdin.flush()

    # 读取响应
    response = proc.stdout.readline()
    print("Received:", response)
    return json.loads(response)

# 列出可用工具
tools_response = send_mcp_request("tool/list", {})
print("Available tools:", tools_response)

# 调用导航工具
navigate_response = send_mcp_request("tool/call", {
    "name": "puppeteer_navigate",
    "arguments": {
        "url": "https://www.baidu.com"
    }
})
print("Navigate response:", navigate_response)

# 截图
screenshot_response = send_mcp_request("tool/call", {
    "name": "puppeteer_screenshot",
    "arguments": {
        "name": "example_screenshot"
    }
})
print("Screenshot response:", screenshot_response)

# 关闭容器
proc.terminate()