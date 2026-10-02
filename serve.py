#!/usr/bin/env python3
"""
serve.py: preview the built site on your phone.

    python serve.py

Serves the built site (this folder, the same one GitHub Pages serves) on
every network interface, port 8000, and prints the address to open on a
phone that is on the same Wi-Fi. Plain http, standard library only.
Run `python build.py` first if you have changed anything in src/ or data/.
Stop it with Ctrl+C.
"""
from __future__ import annotations

import socket
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8000


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
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
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
