#!/usr/bin/env python3
"""
serve.py: preview the built site on your phone.

    python serve.py

Serves docs/ (the folder GitHub Pages publishes) on every network interface,
port 8000, and prints the address to open on a phone that is on the same
Wi-Fi. Like the live site, an address that doesn't exist gets 404.html with
status 404. Plain http, standard library only.
Run `python build.py` first if you have changed anything in src/ or data/.
Stop it with Ctrl+C.
"""
from __future__ import annotations

import io
import socket
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

SITE = Path(__file__).resolve().parent / "docs"
PORT = 8000


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".woff2": "font/woff2", ".avif": "image/avif"}

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            if not urlsplit(self.path).path.endswith("/"):
                return super().send_head()  # redirect to the folder, as the host does
            path = path / "index.html"
        if path.is_file():
            return super().send_head()
        # No such page: the site's own 404 page, with status 404
        page = SITE / "404.html"
        body = page.read_bytes() if page.is_file() else b"404 Not Found"
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8" if page.is_file() else "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)


def lan_address() -> str:
    """This computer's address on the local network. Opening a UDP socket
    towards a public address sends nothing; it only asks the OS which
    interface it would use."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def main() -> None:
    if not (SITE / "index.html").is_file():
        raise SystemExit("docs/ has no built site yet. Run: python build.py")
    handler = partial(Handler, directory=str(SITE))
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"Open on your phone: http://{lan_address()}:{PORT}", flush=True)
    print(f"On this computer:   http://localhost:{PORT}", flush=True)
    print("Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
