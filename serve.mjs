import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
const root = decodeURIComponent(new URL(".", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  try {
    let data = await readFile(join(root, p));
    if (p === "/index.html") {
      // mimic the artifact publish wrapper
      data = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light dark}body{margin:0;font-family:system-ui;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + data.toString("utf8") + "</body></html>";
    }
    res.writeHead(200, { "content-type": (types[extname(p)] || "application/octet-stream") + "; charset=utf-8" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("serving on http://127.0.0.1:4173"));
