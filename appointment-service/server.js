import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT || 3001);
const appointments = [];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8"
  });
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

createServer(async (request, response) => {
  const { pathname } = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "appointment-service" });
    return;
  }

  if (pathname === "/api/appointments" && request.method === "GET") {
    sendJson(response, 200, { appointments });
    return;
  }

  if (pathname === "/api/appointments" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
      const patientName = typeof body.patientName === "string" ? body.patientName.trim() : "";
      const date = typeof body.date === "string" ? body.date : "";
      const time = typeof body.time === "string" ? body.time : "";
      const type = typeof body.type === "string" ? body.type : "";
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T${time}`));
      const validTime = /^\d{2}:\d{2}$/.test(time);
      const validType = ["Primary care", "Telehealth", "Wellness visit"].includes(type);

      if (!patientId || !patientName || !validDate || !validTime || !validType) {
        sendJson(response, 400, { error: "Provide a patient, valid date and time, and visit type." });
        return;
      }

      const appointment = {
        id: `apt-${randomUUID().slice(0, 8)}`,
        patientId,
        patientName: patientName.slice(0, 80),
        date,
        time,
        type,
        status: "Scheduled"
      };
      appointments.unshift(appointment);
      sendJson(response, 201, { appointment });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid request." });
    }
    return;
  }

  sendJson(response, request.method === "GET" ? 404 : 405, { error: "Not found." });
}).listen(port, "0.0.0.0", () => {
  console.log(`appointment-service listening on ${port}`);
});