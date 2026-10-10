#!/usr/bin/env python3
"""开发服务器：禁用缓存（比 python -m http.server 多 no-cache 头），避免更新后浏览器使用旧文件"""
import http.server, socketserver, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8923), NoCacheHandler) as httpd:
    print('Serving http://127.0.0.1:8923/ (no-cache)')
    httpd.serve_forever()
