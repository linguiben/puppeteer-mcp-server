#!/bin/bash
if [[ $#  -ne 1 ]]; then
    echo "Usage: $0 <sse|stdio> [port]"
    exit 1
fi

if [[ $1 != "sse" && $1 != "stdio" ]]; then
    echo "Invalid argument. Use 'sse' or 'stdio'."
    exit 1
fi

MCP_SERVER_PATH=$(dirname "$(realpath "$0")")
# /Users/jupiter/16.vscode-workspace/mcp_study/.venv/bin/python /Users/jupiter/16.vscode-workspace/mcp_study/mcp_server_sse.py

# Set the MCP server mode based on the argument
MCP_SERVER_MODE=$1

# Set the MCP server host:port
MCP_SERVER_HOST="localhost"
if [[ "$2" =~ ^[0-9]+$ ]]; then
    MCP_SERVER_PORT=$2
else
    MCP_SERVER_PORT=8000  # Default 8000
fi

# Set the MCP server log file
MCP_SERVER_LOG_FILE="mcp_server.log"

# Start the MCP server with the specified mode
echo "Starting MCP server in SEE mode..."
# python -m $MCP_SERVER_PATH --port $MCP_SERVER_PORT --host $MCP_SERVER_HOST > $MCP_SERVER_LOG_FILE 2>&1 &
"$MCP_SERVER_PATH/venv/bin/python" "$MCP_SERVER_PATH/mcp_server_$1.py" > "$MCP_SERVER_LOG_FILE" 2>&1 &

# Check if the server started successfully
if [[ $? -eq 0 ]]; then
    echo "MCP server started successfully in $MCP_SERVER_MODE mode."
else
    echo "Failed to start MCP server."
    exit 1
fi
echo "Server log can be found at: $MCP_SERVER_LOG_FILE"

# Wait for the server to finish
wait



