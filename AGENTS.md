# Repository Guidelines

## Project Structure & Module Organization
This repository combines a Python MCP server with Node/Puppeteer capture scripts.

- Root Python entrypoints: `start-mcp-server.py`, `mcp_server_sse.py`, `http_server.py`
- MCP tool implementations: `tools.py`
- Node capture utilities: `capture_url.js`, `url_save_as_html.js`, `sina_world_mobile.js`
- Test files: `test_puppeteer_mcp.py`, `test/test_base64.py`
- Runtime output folders: `images/` (screenshots), `html/` (saved pages)
- Container assets: `Dockerfile`, `docker_build.sh`, `docker.sh`

Keep new modules near related runtime entrypoints unless a reusable package structure is introduced.

## Build, Test, and Development Commands
- `python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`  
  Set up Python dependencies.
- `npm install`  
  Install Puppeteer and Node dependencies.
- `python start-mcp-server.py streamable-http`  
  Run the MCP server on `0.0.0.0:8000`.
- `python start-mcp-server.py stdio`  
  Run in local stdio mode for integration testing.
- `docker build -t puppeteer-mcp:1.0 -f Dockerfile .`  
  Build the container image.

## Coding Style & Naming Conventions
- Python: 4-space indentation, `snake_case` for functions/variables, small focused functions.
- JavaScript: keep scripts task-oriented; prefer descriptive file names like `capture_url.js`.
- Keep CLI/tool argument names explicit (`url`, `width`, `height`, etc.).
- Follow existing style in touched files; do not reformat unrelated code in the same PR.

## Testing Guidelines
- Current tests are script-style checks, not a full pytest suite.
- Add deterministic tests under `test/` and name them `test_<feature>.py`.
- Run targeted checks directly, e.g. `python test/test_base64.py`.
- For MCP behavior changes, include a reproducible request example (curl or JSON-RPC payload) in the PR.

## Commit & Pull Request Guidelines
- Use Conventional Commit style seen in history (e.g., `feat: ...`).
- Keep commits scoped to one change set; include why the change is needed.
- PRs should include:
  - concise summary of behavior changes,
  - verification steps/commands run,
  - sample output or screenshot path when capture behavior changes.

## Security & Configuration Tips
- `run_cmd` executes shell commands; treat all inputs as untrusted and restrict exposure in production.
- Do not commit generated screenshots, HTML dumps, logs, or credentials.
