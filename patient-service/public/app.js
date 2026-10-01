const appointmentApi = window.CUROVIA_APPOINTMENTS_API || "";
const patientList = document.querySelector("#patient-list");
const appointmentList = document.querySelector("#appointment-list");
const patientSelect = document.querySelector("#appointment-patient");
const patientMessage = document.querySelector("#patient-message");
const appointmentMessage = document.querySelector("#appointment-message");
const patientCount = document.querySelector("#patient-count");
const appointmentCount = document.querySelector("#appointment-count");

function element(tagName, className, text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function renderPatients(patients) {
  patientList.replaceChildren();
  patientSelect.replaceChildren();
  patientCount.textContent = String(patients.length);
  if (!patients.length) patientList.append(element("p", "empty-state", "Add a patient to get started."));

  for (const patient of patients) {
    const row = element("div", "record-row");
    const person = element("div", "record-person");
    person.append(element("span", "record-avatar", patient.name.trim().charAt(0).toUpperCase()));
    person.append(element("span", "record-name", patient.name));
    row.append(person, element("span", "record-meta", patient.id));
    patientList.append(row);
    const option = element("option", "", patient.name);
    option.value = patient.id;
    patientSelect.append(option);
  }
  document.querySelector("#appointment-form button").disabled = patients.length === 0;
}

function renderAppointments(appointments) {
  appointmentList.replaceChildren();
  appointmentCount.textContent = String(appointments.length);
  if (!appointments.length) appointmentList.append(element("p", "empty-state", "No visits scheduled yet."));

  for (const appointment of appointments) {
    const row = element("div", "record-row");
    const person = element("div", "record-person");
    person.append(element("span", "record-avatar", "+"));
    const details = element("div");
    details.append(element("div", "record-name", appointment.patientName));
    details.append(element("div", "record-meta", appointment.type));
    person.append(details);
    const when = new Date(`${appointment.date}T${appointment.time}`).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    row.append(person, element("span", "record-meta", when));
    appointmentList.append(row);
  }
}

async function loadWorkspace() {
  const [patientData, appointmentData] = await Promise.all([
    requestJson("/api/patients"),
    requestJson(`${appointmentApi}/api/appointments`)
  ]);
  renderPatients(patientData.patients);
  renderAppointments(appointmentData.appointments);
}

document.querySelector("#patient-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  patientMessage.textContent = "";
  const form = new FormData(event.currentTarget);
  try {
    await requestJson("/api/patients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) });
    event.currentTarget.reset();
    await loadWorkspace();
  } catch (error) {
    patientMessage.textContent = error.message;
  }
});

document.querySelector("#appointment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  appointmentMessage.textContent = "";
  const form = new FormData(event.currentTarget);
  const selectedPatient = patientSelect.selectedOptions[0];
  try {
    await requestJson(`${appointmentApi}/api/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patientId: form.get("patientId"), patientName: selectedPatient?.textContent || "", date: form.get("date"), time: form.get("time"), type: form.get("type") })
    });
    await loadWorkspace();
  } catch (error) {
    appointmentMessage.textContent = error.message;
  }
});

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
document.querySelector("#appointment-date").value = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, "0"), String(tomorrow.getDate()).padStart(2, "0")].join("-");

loadWorkspace().catch((error) => {
  patientMessage.textContent = error.message;
  appointmentMessage.textContent = "Check that both services are running.";
});