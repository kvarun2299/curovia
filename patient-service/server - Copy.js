import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3000);
const publicDir = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const patients = [
  { id: "pat-1001", name: "Jordan Lee", createdAt: new Date().toISOString() },
  { id: "pat-1002", name: "Casey Morgan", createdAt: new Date().toISOString() }
];
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) throw new Error("Request body is too large.");
  }
  return JSON.parse(body || "{}");
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (relativePath.includes("..") || relativePath.includes("\\")) {
    sendJson(response, 400, { error: "Invalid path." });
    return;
  }

  try {
    const content = await readFile(join(publicDir, relativePath));
    response.writeHead(200, {
      "content-type": contentTypes[extname(relativePath)] || "application/octet-stream",
      "x-content-type-options": "nosniff"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "patient-service" });
    return;
  }

  if (request.method === "GET" && pathname === "/config.js") {
    const appointmentApiUrl = JSON.stringify(process.env.APPOINTMENTS_API_URL || "");
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(`window.CUROVIA_APPOINTMENTS_API = ${appointmentApiUrl};`);
    return;
  }

  if (pathname === "/api/patients" && request.method === "GET") {
    sendJson(response, 200, { patients });
    return;
  }

  if (pathname === "/api/patients" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) {
        sendJson(response, 400, { error: "Enter a name up to 80 characters." });
        return;
      }
      const patient = { id: `pat-${randomUUID().slice(0, 8)}`, name, createdAt: new Date().toISOString() };
      patients.unshift(patient);
      sendJson(response, 201, { patient });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid request." });
    }
    return;
  }

  if (request.method === "GET") {
    await serveStatic(response, pathname);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}).listen(port, "0.0.0.0", () => {
  console.log(`patient-service listening on ${port}`);
});