let assignments = [];
let editingId = null;

const rows = document.querySelector("#assignment-rows");
const caption = document.querySelector("#results-caption");
const form = document.querySelector("#assignment-form");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const loginCard = document.querySelector("#login-card");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginError = document.querySelector("#login-error");
const logoutButton = document.querySelector("#logout-button");
const userLabel = document.querySelector("#user-label");
const contentGrid = document.querySelector("#content-grid");

const entities = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;",
};
const escapeHtml = (value) =>
	String(value).replace(/[&<>"']/g, (character) => entities[character]);

const request = async (url, options) => {
	const response = await fetch(url, options);
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(data.error || "Request failed.");
		error.status = response.status;
		throw error;
	}
	return data;
};

const showLogin = () => {
	loginCard.hidden = false;
	contentGrid.hidden = true;
	logoutButton.hidden = true;
	userLabel.hidden = true;
};

const showApp = (username) => {
	loginCard.hidden = true;
	loginError.hidden = true;
	loginForm.reset();
	contentGrid.hidden = false;
	logoutButton.hidden = false;
	userLabel.hidden = false;
	userLabel.textContent = username;
};

const render = () => {
	caption.textContent = `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} tracked`;
	rows.innerHTML = assignments.length
		? assignments
				.map(
					(assignment) => `
		<tr>
			<th scope="row">${escapeHtml(assignment.title)}</th>
			<td>${escapeHtml(assignment.course)}</td>
			<td>${assignment.dueDate}</td>
			<td>${assignment.daysRemaining} days</td>
			<td>${assignment.hours} hours</td>
			<td>${assignment.priority}</td>
			<td>${assignment.urgency}</td>
			<td class="text-nowrap"><button class="btn btn-link btn-sm p-0 me-2" type="button" data-action="edit" data-id="${assignment.id}">Edit</button><button class="btn btn-link btn-sm p-0" type="button" data-action="delete" data-id="${assignment.id}">Delete</button></td>
		</tr>`,
				)
				.join("")
		: '<tr><td colspan="8" class="text-center text-muted">No assignments yet. Add one using the form.</td></tr>';
};

const useServerData = ({ assignments: updatedAssignments }) => {
	assignments = updatedAssignments;
	render();
};

const resetForm = () => {
	editingId = null;
	form.reset();
	formTitle.textContent = "Add an assignment";
	saveButton.textContent = "Add assignment";
	cancelButton.hidden = true;
};

const editAssignment = (id) => {
	const assignment = assignments.find((item) => item.id === id);
	if (!assignment) return;

	editingId = id;
	["title", "course", "dueDate", "hours", "priority"].forEach((name) => {
		form.elements[name].value = assignment[name];
	});
	formTitle.textContent = "Update an assignment";
	saveButton.textContent = "Save changes";
	cancelButton.hidden = false;
	form.elements.title.focus();
};

const deleteAssignment = async (id) => {
	try {
		useServerData(
			await request(`/api/assignments/${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		);
		if (editingId === id) resetForm();
	} catch (error) {
		if (error.status === 401) {
			showLogin();
			return;
		}
		alert(error.message);
	}
};

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	const id = editingId;
	const endpoint = id
		? `/api/assignments/${encodeURIComponent(id)}`
		: "/api/assignments";

	saveButton.disabled = true;
	saveButton.textContent = "Saving...";
	try {
		useServerData(
			await request(endpoint, {
				method: id ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(Object.fromEntries(new FormData(form))),
			}),
		);
		resetForm();
	} catch (error) {
		if (error.status === 401) {
			showLogin();
			return;
		}
		alert(error.message);
	} finally {
		saveButton.disabled = false;
		saveButton.textContent = editingId ? "Save changes" : "Add assignment";
	}
});

loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	loginError.hidden = true;
	loginButton.disabled = true;
	loginButton.textContent = "Logging in...";
	try {
		const data = await request("/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(Object.fromEntries(new FormData(loginForm))),
		});
		showApp(data.username);
		useServerData(await request("/api/assignments"));
	} catch (error) {
		loginError.textContent = error.message;
		loginError.hidden = false;
	} finally {
		loginButton.disabled = false;
		loginButton.textContent = "Log in";
	}
});

logoutButton.addEventListener("click", async () => {
	try {
		await request("/logout", { method: "POST" });
	} catch (error) {
		if (error.status !== 401) {
			alert(error.message);
			return;
		}
	}
	resetForm();
	assignments = [];
	render();
	showLogin();
});

cancelButton.addEventListener("click", resetForm);
rows.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-action]");
	if (!button) return;
	if (button.dataset.action === "edit") editAssignment(button.dataset.id);
	if (button.dataset.action === "delete") deleteAssignment(button.dataset.id);
});

const loadSession = async () => {
	try {
		const me = await request("/api/me");
		showApp(me.username);
		useServerData(await request("/api/assignments"));
	} catch (error) {
		showLogin();
		if (error.status !== 401) {
			caption.textContent = "Unable to load assignments";
			rows.innerHTML =
				'<tr><td colspan="8" class="text-center text-danger">Could not reach the server. Reload to try again.</td></tr>';
		}
	}
};

loadSession();
