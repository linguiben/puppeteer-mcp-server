# MCP = modle control protocol, invented by Anthropic
# This is a demo of how to use MCP with a custom tool
# and run it with FastMCP, a fast implementation of MCP.
# The tool will return the host information in JSON format.
# The MCP server will run and listen for requests, responding with the host information.
# The server can be run with different transports, such as stdio or SSE.
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile
from starlette.background import BackgroundTask
from starlette.responses import FileResponse, JSONResponse, RedirectResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles
import uvicorn
from mcp.server.fastmcp import FastMCP
import tools
import sys

SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8001
APP_DIR = Path(__file__).resolve().parent
TEST_DIR = APP_DIR / "test"
DOWNLOAD_ROOT_CANDIDATES = {
    "html": [Path("/app/html"), APP_DIR / "html"],
    "images": [Path("/app/images"), APP_DIR / "images"],
}

# Create a FastMCP instance with a name
mcp = FastMCP(
    "host info mcp", host=SERVER_HOST, port=SERVER_PORT, stateless_http=True
)
# Pin streamable HTTP path to keep URL behavior stable across environments.
mcp.settings.streamable_http_path = "/mcp/"
# mcp = FastMCP("host info mcp")
# mcp = FastMCP("host info mcp", host="0.0.0.0", port=8000)
# mcp.settings.mount_path = "/hsil/sse"
# Mount the SSE server to the existing ASGI server
# app = Starlette(
#     routes=[
#         Mount("/hsil/sse", app=mcp.sse_app()),
#         Mount("/hsil/sse/", app=mcp.sse_app()),
#     ]
# )

# Add the custom tool to the MCP instance
mcp.add_tool(tools.webpage_capture)
mcp.add_tool(tools.webpage_save_to_html)
mcp.add_tool(tools.run_cmd, name="run_cmd", description="run a command in the host")


@mcp.tool()
def system_info():
    """Get system information and return it as a JSON string."""
    print(f"Running system_info()")
    import platform
    import json

    system_info = {
        "system": platform.system(),
        "node": platform.node(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "platform": platform.platform(),
    }
    return json.dumps(system_info, indent=2)


def resolve_download_root(bucket: str) -> Path:
    candidates = DOWNLOAD_ROOT_CANDIDATES.get(bucket)
    if not candidates:
        raise ValueError(f"Unsupported download bucket: {bucket}")

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    return candidates[-1].resolve()


def build_download_url(request, bucket: str, relative_path: str) -> str:
    route_name = (
        "test_download_saved_file"
        if request.url.path.startswith("/test/")
        else "download_saved_file"
    )
    return str(
        request.url_for(route_name, bucket=bucket, relative_path=relative_path)
    )


def collect_download_entries(bucket: str, request=None) -> dict:
    root = resolve_download_root(bucket)
    items = []

    if root.exists():
        entries = [entry for entry in root.iterdir() if entry.name != ".gitkeep"]
        entries.sort(key=lambda entry: (entry.stat().st_mtime, entry.name), reverse=True)

        for entry in entries:
            stat = entry.stat()
            relative_path = entry.relative_to(root).as_posix()
            items.append(
                {
                    "name": entry.name,
                    "relative_path": relative_path,
                    "kind": "directory" if entry.is_dir() else "file",
                    "modified_at": int(stat.st_mtime),
                    "size_bytes": stat.st_size if entry.is_file() else None,
                    "download_url": (
                        build_download_url(request, bucket, relative_path)
                        if request is not None
                        else None
                    ),
                }
            )

    return {"bucket": bucket, "root": str(root), "items": items}


def resolve_download_entry(bucket: str, relative_path: str) -> Path:
    root = resolve_download_root(bucket)
    candidate = (root / relative_path).resolve()
    candidate.relative_to(root)
    return candidate


def create_zip_archive(directory: Path) -> Path:
    with NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        archive_path = Path(tmp.name)

    with ZipFile(archive_path, mode="w", compression=ZIP_DEFLATED) as archive:
        for child in directory.rglob("*"):
            if child.is_file():
                arcname = (Path(directory.name) / child.relative_to(directory)).as_posix()
                archive.write(child, arcname=arcname)

    return archive_path


def cleanup_temp_file(path: str):
    try:
        Path(path).unlink()
    except FileNotFoundError:
        pass


async def redirect_to_tester(_request):
    return RedirectResponse(url="/test/mcp_call_tester.html", status_code=307)


async def list_downloads(request):
    bucket = request.path_params["bucket"]
    try:
        payload = collect_download_entries(bucket, request=request)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)

    return JSONResponse(payload)


async def download_saved_file(request):
    bucket = request.path_params["bucket"]
    relative_path = request.path_params["relative_path"]

    try:
        target = resolve_download_entry(bucket, relative_path)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    except Exception:
        return JSONResponse({"error": "Invalid download path."}, status_code=400)

    if not target.exists():
        return JSONResponse({"error": "Requested file was not found."}, status_code=404)

    if target.is_dir():
        archive_path = create_zip_archive(target)
        return FileResponse(
            str(archive_path),
            media_type="application/zip",
            filename=f"{target.name}.zip",
            background=BackgroundTask(cleanup_temp_file, str(archive_path)),
        )

    return FileResponse(str(target), filename=target.name)


def build_streamable_http_app():
    mcp_app = mcp.streamable_http_app()

    # Use FastMCP's Starlette app directly so its lifespan/session manager
    # initialization remains intact, then add local test routes.
    mcp_app.router.routes.append(
        Route(
            "/test/downloads/api/list/{bucket:str}",
            endpoint=list_downloads,
            name="test_list_downloads",
        )
    )
    mcp_app.router.routes.append(
        Route(
            "/test/downloads/api/download/{bucket:str}/{relative_path:path}",
            endpoint=download_saved_file,
            name="test_download_saved_file",
        )
    )
    mcp_app.router.routes.append(
        Mount("/test", app=StaticFiles(directory=str(TEST_DIR), html=True))
    )
    mcp_app.router.routes.append(
        Route(
            "/downloads/api/list/{bucket:str}",
            endpoint=list_downloads,
            name="list_downloads",
        )
    )
    mcp_app.router.routes.append(
        Route(
            "/downloads/api/download/{bucket:str}/{relative_path:path}",
            endpoint=download_saved_file,
            name="download_saved_file",
        )
    )
    mcp_app.router.routes.append(Route("/", endpoint=redirect_to_tester))
    return mcp_app


# stido transport is useful for local testing, while sse is useful for web applications.
def main(transport: str = ""):
    if transport == "":
        user_input = input(
            "please choose a transport:\n1. stdio\n2. sse\n3. streamable-http\nEnter your choice (1/2/3): "
        )
        if user_input == "1":
            transport = "stdio"
        elif user_input == "2":
            transport = "sse"
        elif user_input == "3":
            transport = "streamable-http"
        else:
            print("Invalid input, please try again.")
            return
    if transport == "streamable-http":
        mcp_app = build_streamable_http_app()
        uvicorn.run(mcp_app, host=SERVER_HOST, port=SERVER_PORT)
        return

    mcp.run(transport=transport)
    # mcp.run("stdio") # Run the MCP server with stdio transport or sse (Server-Sent Events)
    # mcp.run("sse", mount_path="/hsil/sse")
    # mcp.run("streamable-http")
    # uvicorn.run("mcp_server_sse:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    # receive transport type from command line argument
    transport_type = "streamable-http"
    if len(sys.argv) > 1:
        transport_type = sys.argv[1]
    print(f"Starting MCP server with transport type: {transport_type}")
    main(transport_type)
