import { useState, useEffect } from "react";

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

function Header({ username, onLogout }) {
	return (
		<header className="navbar navbar-light bg-white border-bottom">
			<div className="container d-flex justify-content-between align-items-center">
				<a className="navbar-brand fw-bold" href="/">
					Due Soon
				</a>
				<span className="d-flex align-items-center gap-2">
					{username ? (
						<>
							<span className="text-muted small fw-bold">{username}</span>
							<button
								className="btn btn-link btn-sm"
								type="button"
								onClick={onLogout}
							>
								Log out
							</button>
						</>
					) : (
						<span className="text-muted small">WPI Assignment Tracker</span>
					)}
				</span>
			</div>
		</header>
	);
}

function Footer() {
	return (
		<footer className="container d-flex justify-content-between text-muted small py-3 mt-auto">
			<span className="fw-bold">Due Soon</span>
			<span>Assignment data is stored per user in MongoDB.</span>
		</footer>
	);
}

function LoginCard({ onLogin }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setBusy(true);
		try {
			const data = await request("/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			onLogin(data.username);
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section
			className="card shadow-sm mx-auto"
			style={{ maxWidth: "480px" }}
		>
			<div className="card-body">
				<h2 className="card-title h4">Log in</h2>
				<p className="card-text text-muted small">
					New accounts are created automatically on first login.
				</p>
				<form onSubmit={handleSubmit}>
					<div className="mb-3">
						<label className="form-label" htmlFor="login-username">
							Username
						</label>
						<input
							className="form-control"
							id="login-username"
							type="text"
							maxLength="50"
							autoComplete="username"
							required
							value={username}
							onChange={(e) => setUsername(e.target.value)}
						/>
					</div>
					<div className="mb-3">
						<label className="form-label" htmlFor="login-password">
							Password
						</label>
						<input
							className="form-control"
							id="login-password"
							type="password"
							maxLength="200"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<div className="d-grid">
						<button className="btn btn-primary" type="submit" disabled={busy}>
							{busy ? "Logging in..." : "Log in"}
						</button>
					</div>
				</form>
				{error && <p className="alert alert-danger mt-3 mb-0">{error}</p>}
			</div>
		</section>
	);
}

function AssignmentRow({ assignment, onEdit, onDelete }) {
	return (
		<tr>
			<th scope="row">{assignment.title}</th>
			<td>{assignment.course}</td>
			<td>{assignment.dueDate}</td>
			<td>{assignment.daysRemaining} days</td>
			<td>{assignment.hours} hours</td>
			<td>{assignment.priority}</td>
			<td>{assignment.urgency}</td>
			<td className="text-nowrap">
				<button
					className="btn btn-link btn-sm p-0 me-2"
					type="button"
					onClick={() => onEdit(assignment.id)}
				>
					Edit
				</button>
				<button
					className="btn btn-link btn-sm p-0"
					type="button"
					onClick={() => onDelete(assignment.id)}
				>
					Delete
				</button>
			</td>
		</tr>
	);
}

function AssignmentTable({ assignments, loading, loadError, onEdit, onDelete }) {
	const caption = loading
		? "Loading assignments..."
		: loadError
			? "Unable to load assignments"
			: `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} tracked`;

	return (
		<div className="card shadow-sm">
			<div className="card-body">
				<h2 className="card-title h4">Assignments</h2>
				<p className="text-muted small border-bottom pb-3">{caption}</p>
				<div className="table-responsive">
					<table className="table table-striped table-hover align-middle mb-0">
						<thead>
							<tr>
								<th scope="col">Assignment</th>
								<th scope="col">Course</th>
								<th scope="col">Due</th>
								<th scope="col">Days left</th>
								<th scope="col">Hours</th>
								<th scope="col">Priority</th>
								<th scope="col">Urgency</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan="8" className="text-center text-muted">
										Loading assignments...
									</td>
								</tr>
							) : loadError ? (
								<tr>
									<td colSpan="8" className="text-center text-danger">
										Could not reach the server. Reload to try again.
									</td>
								</tr>
							) : assignments.length === 0 ? (
								<tr>
									<td colSpan="8" className="text-center text-muted">
										No assignments yet. Add one using the form.
									</td>
								</tr>
							) : (
								assignments.map((assignment) => (
									<AssignmentRow
										key={assignment.id}
										assignment={assignment}
										onEdit={onEdit}
										onDelete={onDelete}
									/>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

const emptyForm = {
	title: "",
	course: "",
	dueDate: "",
	hours: "",
	priority: "medium",
};

const toFormValues = (editingAssignment) => ({
	title: editingAssignment?.title || "",
	course: editingAssignment?.course || "",
	dueDate: editingAssignment?.dueDate || "",
	hours:
		editingAssignment?.hours === undefined ||
		editingAssignment?.hours === null
			? ""
			: String(editingAssignment.hours),
	priority: editingAssignment?.priority || "medium",
});

function AssignmentForm({ editingAssignment, onSave, onCancel }) {
	const [values, setValues] = useState(() =>
		toFormValues(editingAssignment),
	);
	const [saving, setSaving] = useState(false);
	const editingId = editingAssignment ? editingAssignment.id : null;

	const set = (name) => (event) =>
		setValues((prev) => ({ ...prev, [name]: event.target.value }));

	const handleSubmit = async (event) => {
		event.preventDefault();
		setSaving(true);
		try {
			await onSave({
				title: values.title.trim(),
				course: values.course.trim(),
				dueDate: values.dueDate,
				hours: Number(values.hours),
				priority: values.priority,
			});
			setValues(emptyForm);
		} catch (err) {
			alert(err.message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="card shadow-sm">
			<div className="card-body">
				<h2 className="card-title h4">
					{editingId ? "Update an assignment" : "Add an assignment"}
				</h2>
				<form className="border-top pt-3 mt-3" onSubmit={handleSubmit}>
					<div className="row g-3">
						<div className="col-12">
							<label className="form-label" htmlFor="field-title">
								Assignment name
							</label>
							<input
								className="form-control"
								id="field-title"
								type="text"
								maxLength="100"
								placeholder="e.g. Short Stack"
								required
								value={values.title}
								onChange={set("title")}
							/>
						</div>
						<div className="col-12">
							<label className="form-label" htmlFor="field-course">
								Course
							</label>
							<input
								className="form-control"
								id="field-course"
								type="text"
								maxLength="30"
								placeholder="e.g. CS 4241"
								required
								value={values.course}
								onChange={set("course")}
							/>
						</div>
						<div className="col-6">
							<label className="form-label" htmlFor="field-due">
								Due date
							</label>
							<input
								className="form-control"
								id="field-due"
								type="date"
								required
								value={values.dueDate}
								onChange={set("dueDate")}
							/>
						</div>
						<div className="col-6">
							<label className="form-label" htmlFor="field-hours">
								Estimated hours
							</label>
							<input
								className="form-control"
								id="field-hours"
								type="number"
								min="0.5"
								max="100"
								step="0.5"
								placeholder="4"
								required
								value={values.hours}
								onChange={set("hours")}
							/>
						</div>
						<div className="col-12">
							<label className="form-label" htmlFor="field-priority">
								Priority
							</label>
							<select
								className="form-select"
								id="field-priority"
								required
								value={values.priority}
								onChange={set("priority")}
							>
								<option value="high">High</option>
								<option value="medium">Medium</option>
								<option value="low">Low</option>
							</select>
						</div>
					</div>
					<div className="d-flex gap-2 mt-3">
						<button
							className="btn btn-primary flex-fill"
							type="submit"
							disabled={saving}
						>
							{saving
								? "Saving..."
								: editingId
									? "Save changes"
									: "Add assignment"}
						</button>
						{editingId && (
							<button
								className="btn btn-secondary flex-fill"
								type="button"
								onClick={onCancel}
							>
								Cancel edit
							</button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
}

function App() {
	const [username, setUsername] = useState(null);
	const [authChecked, setAuthChecked] = useState(false);
	const [assignments, setAssignments] = useState([]);
	const [editingId, setEditingId] = useState(null);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState(false);

	const editingAssignment =
		assignments.find((item) => item.id === editingId) || null;

	const loadAssignments = async () => {
		setLoading(true);
		setLoadError(false);
		try {
			const data = await request("/api/assignments");
			setAssignments(data.assignments || []);
		} catch (err) {
			if (err.status === 401) {
				setUsername(null);
			} else {
				setLoadError(true);
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		(async () => {
			try {
				const me = await request("/api/me");
				setUsername(me.username);
				await loadAssignments();
			} catch (err) {
				setUsername(null);
				if (err.status !== 401) {
					setLoadError(true);
				}
			} finally {
				setAuthChecked(true);
			}
		})();
	}, []);

	const handleLogin = async (name) => {
		setUsername(name);
		setAuthChecked(true);
		await loadAssignments();
	};

	const handleLogout = async () => {
		try {
			await request("/logout", { method: "POST" });
		} catch (err) {
			if (err.status !== 401) {
				alert(err.message);
				return;
			}
		}
		setUsername(null);
		setAssignments([]);
		setEditingId(null);
	};

	const handleSave = async (payload) => {
		const endpoint = editingId
			? `/api/assignments/${encodeURIComponent(editingId)}`
			: "/api/assignments";
		try {
			const data = await request(endpoint, {
				method: editingId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			setAssignments(data.assignments || []);
			setEditingId(null);
		} catch (err) {
			if (err.status === 401) {
				setUsername(null);
				throw new Error("Session expired. Please log in again.");
			}
			throw err;
		}
	};

	const handleDelete = async (id) => {
		try {
			const data = await request(
				`/api/assignments/${encodeURIComponent(id)}`,
				{ method: "DELETE" },
			);
			setAssignments(data.assignments || []);
			if (editingId === id) setEditingId(null);
		} catch (err) {
			if (err.status === 401) {
				setUsername(null);
				return;
			}
			alert(err.message);
		}
	};

	if (!authChecked) {
		return (
			<>
				<Header username={null} onLogout={handleLogout} />
				<main className="container py-4 flex-grow-1">
					<p className="text-center text-muted">Loading Due Soon...</p>
				</main>
				<Footer />
			</>
		);
	}

	return (
		<>
			<Header username={username} onLogout={handleLogout} />
			<main className="container py-4 flex-grow-1">
				{!username ? (
					<LoginCard onLogin={handleLogin} />
				) : (
					<div className="row g-4">
						<section className="col-lg-8">
							<AssignmentTable
								assignments={assignments}
								loading={loading}
								loadError={loadError}
								onEdit={setEditingId}
								onDelete={handleDelete}
							/>
						</section>
						<section className="col-lg-4">
							<AssignmentForm
								key={editingId || "new"}
								editingAssignment={editingAssignment}
								onSave={handleSave}
								onCancel={() => setEditingId(null)}
							/>
						</section>
					</div>
				)}
			</main>
			<Footer />
		</>
	);
}

export default App;
