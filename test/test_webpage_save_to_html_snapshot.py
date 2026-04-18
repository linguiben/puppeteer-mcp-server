import functools
import http.server
import json
import shutil
import subprocess
import tempfile
import textwrap
import threading
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).strip() + "\n", encoding="utf-8")


def build_fixture_site(root: Path) -> None:
    write_text(
        root / "index.html",
        """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>snapshot fixture</title>
          <link rel="stylesheet" href="/styles/site.css">
          <script src="/scripts/app.js" defer></script>
        </head>
        <body>
          <h1>offline snapshot fixture</h1>
          <p id="script-status">pending</p>
          <a id="next-link" href="/linked.html">linked page</a>
          <img id="hero" src="/images/logo.svg" alt="hero logo">
          <div id="inline-box" style="background-image: url('/images/inline.svg'); width: 120px; height: 120px;"></div>
          <div style="height: 2600px;"></div>
        </body>
        </html>
        """,
    )

    write_text(
        root / "linked.html",
        """
        <!doctype html>
        <html lang="en">
        <body>
          <p>this page must not be downloaded unless opened directly</p>
        </body>
        </html>
        """,
    )

    write_text(
        root / "styles" / "site.css",
        """
        @font-face {
          font-family: "MockFont";
          src: url("/fonts/mock.woff2") format("woff2");
        }

        body {
          margin: 0;
          font-family: "MockFont", sans-serif;
          background-image: url("/images/bg.svg");
          background-repeat: no-repeat;
        }

        #hero {
          display: block;
          width: 140px;
        }

        #inline-box {
          border: 2px solid #222;
        }

        .panel {
          background-image: url("../images/pattern.svg");
        }
        """,
    )

    write_text(
        root / "scripts" / "app.js",
        """
        document.addEventListener("DOMContentLoaded", () => {
          document.getElementById("script-status").textContent = "script-loaded";

          let lazyLoaded = false;
          window.addEventListener(
            "scroll",
            () => {
              if (lazyLoaded) {
                return;
              }

              const nearBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 40;

              if (!nearBottom) {
                return;
              }

              const panel = document.createElement("div");
              panel.className = "panel";
              panel.textContent = "lazy panel";
              panel.style.width = "160px";
              panel.style.height = "160px";
              document.body.appendChild(panel);

              const img = document.createElement("img");
              img.id = "lazy-img";
              img.src = "/images/lazy.svg";
              img.alt = "lazy image";
              document.body.appendChild(img);

              lazyLoaded = true;
            },
            { passive: true }
          );
        });
        """,
    )

    for file_name, label, color in [
        ("logo.svg", "logo", "#3178c6"),
        ("inline.svg", "inline", "#e67e22"),
        ("lazy.svg", "lazy", "#16a085"),
        ("bg.svg", "background", "#8e44ad"),
        ("pattern.svg", "pattern", "#2c3e50"),
    ]:
        write_text(
            root / "images" / file_name,
            f"""
            <svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120">
              <rect width="240" height="120" fill="{color}" />
              <text x="20" y="68" fill="#ffffff" font-size="24">{label}</text>
            </svg>
            """,
        )


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    created_snapshot_dir = None

    with tempfile.TemporaryDirectory() as temp_dir:
        site_root = Path(temp_dir) / "site"
        build_fixture_site(site_root)

        handler = functools.partial(
            http.server.SimpleHTTPRequestHandler,
            directory=str(site_root),
        )
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()

        try:
            fixture_url = f"http://127.0.0.1:{server.server_port}/index.html"
            result = subprocess.run(
                ["node", "url_save_as_html.js", fixture_url],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=True,
            )

            relative_entry = result.stdout.strip()
            assert_true(relative_entry.endswith("/index.html"), "entry path should end with index.html")

            entry_path = REPO_ROOT / relative_entry
            created_snapshot_dir = entry_path.parent

            assert_true(entry_path.exists(), "snapshot index.html should exist")
            manifest_path = created_snapshot_dir / "manifest.json"
            assert_true(manifest_path.exists(), "manifest.json should exist")

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            resource_paths = {item["relative_path"] for item in manifest["resources"]}

            assert_true(manifest["auto_scrolled"] is True, "auto scroll should be enabled")
            assert_true(
                any(path.endswith("/styles/site.css") for path in resource_paths),
                "stylesheet should be saved",
            )
            assert_true(
                any(path.endswith("/scripts/app.js") for path in resource_paths),
                "script should be saved",
            )
            assert_true(
                any(path.endswith("/images/logo.svg") for path in resource_paths),
                "hero image should be saved",
            )
            assert_true(
                any(path.endswith("/images/bg.svg") for path in resource_paths),
                "css background image should be saved",
            )
            assert_true(
                any(path.endswith("/images/inline.svg") for path in resource_paths),
                "inline style background image should be saved",
            )
            assert_true(
                any(path.endswith("/images/lazy.svg") for path in resource_paths),
                "lazy-loaded image should be saved",
            )
            assert_true(
                not any("linked.html" in path for path in resource_paths),
                "linked target page should not be saved",
            )

            html_text = entry_path.read_text(encoding="utf-8")
            assert_true("script-loaded" in html_text, "rendered DOM content should be captured")
            assert_true('href="assets/' in html_text, "stylesheet path should be rewritten to local asset")
            assert_true('src="assets/' in html_text, "image path should be rewritten to local asset")
            assert_true("lazy-img" in html_text, "lazy-loaded DOM nodes should be present in snapshot")
            assert_true(
                'href="/linked.html"' in html_text,
                "hyperlink target should remain unchanged instead of being crawled",
            )

            css_relative_path = next(
                path for path in resource_paths if path.endswith("/styles/site.css")
            )
            css_text = (created_snapshot_dir / css_relative_path).read_text(encoding="utf-8")
            assert_true(
                "url(\"../images/bg.svg\")" in css_text or "url(../images/bg.svg)" in css_text,
                "absolute CSS asset paths should be rewritten relative to the saved css file",
            )

            print("PASS: webpage_save_to_html snapshot test")
        finally:
            server.shutdown()
            server.server_close()
            server_thread.join(timeout=5)

    if created_snapshot_dir and created_snapshot_dir.exists():
        shutil.rmtree(created_snapshot_dir)


if __name__ == "__main__":
    main()
