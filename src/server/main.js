import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import session from "express-session";
import { MongoClient } from "mongodb";
import ViteExpress from "vite-express";

const port = process.env.PORT || 3000;
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const priorities = new Set(["low", "medium", "high"]);
const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET || "due-soon-dev-secret";

if (!mongoUri) {
	console.error("Missing MONGODB_URI environment variable.");
	process.exit(1);
}

const parseDate = (value) => {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}
	const parts = value.split("-").map(Number);
	const year = parts[0];
	const month = parts[1];
	const day = parts[2];
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	) {
		return date;
	}
	return null;
};

const addDerivedFields = (assignment) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const parsed = parseDate(assignment.dueDate);
	const daysRemaining = Math.round((parsed - today) / dayInMilliseconds);
	let urgency = "On track";
	if (daysRemaining < 0) {
		urgency = "Overdue";
	} else if (
		daysRemaining <= 2 ||
		(assignment.priority === "high" && daysRemaining <= 7)
	) {
		urgency = "Due soon";
	} else if (assignment.priority === "high") {
		urgency = "High priority";
	}
	return { ...assignment, daysRemaining, urgency };
};

const validate = (input) => {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Assignment data must be an object.");
	}
	const assignment = {
		title: typeof input.title === "string" ? input.title.trim() : "",
		course: typeof input.course === "string" ? input.course.trim() : "",
		dueDate: input.dueDate,
		priority: input.priority,
		hours: Number(input.hours),
	};
	if (!assignment.title || assignment.title.length > 100) {
		throw new Error(
			"Assignment name must be between 1 and 100 characters.",
		);
	}
	if (!assignment.course || assignment.course.length > 30) {
		throw new Error("Course must be between 1 and 30 characters.");
	}
	if (!parseDate(assignment.dueDate)) {
		throw new Error("Due date must be a valid date.");
	}
	if (!priorities.has(assignment.priority)) {
		throw new Error("Priority must be low, medium, or high.");
	}
	if (
		!Number.isFinite(assignment.hours) ||
		assignment.hours < 0.5 ||
		assignment.hours > 100 ||
		assignment.hours % 0.5 !== 0
	) {
		throw new Error(
			"Estimated hours must be between 0.5 and 100 in half-hour increments.",
		);
	}
	return assignment;
};

const requireAuth = (request, response, next) => {
	if (!request.session || !request.session.username) {
		return response.status(401).json({ error: "Not authenticated." });
	}
	next();
};

const stripMongoId = (doc) => {
	const cleaned = { ...doc };
	delete cleaned._id;
	return cleaned;
};

const app = express();
app.use(express.json());
app.use(
	session({
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
	}),
);

const client = new MongoClient(mongoUri);
let users;
let assignments;

const assignmentsForUser = async (username) => {
	const docs = await assignments.find({ username }).toArray();
	return docs.map((doc) => addDerivedFields(stripMongoId(doc)));
};

app.post("/login", async (request, response) => {
	try {
		const body = request.body || {};
		const username =
			typeof body.username === "string" ? body.username.trim() : "";
		const password = typeof body.password === "string" ? body.password : "";
		if (!username || !password) {
			return response
				.status(400)
				.json({ error: "Username and password required." });
		}
		const existing = await users.findOne({ username });
		if (!existing) {
			await users.insertOne({ username, password });
			request.session.username = username;
			return response.status(201).json({ username });
		}
		if (existing.password !== password) {
			return response
				.status(401)
				.json({ error: "Invalid username or password." });
		}
		request.session.username = username;
		return response.json({ username });
	} catch (error) {
		console.error(error);
		return response
			.status(500)
			.json({ error: "The request could not be completed." });
	}
});

app.post("/logout", (request, response) => {
	request.session.destroy((error) => {
		if (error) {
			console.error(error);
			return response
				.status(500)
				.json({ error: "The request could not be completed." });
		}
		response.clearCookie("connect.sid");
		return response.json({ ok: true });
	});
});

app.get("/api/me", requireAuth, (request, response) => {
	return response.json({ username: request.session.username });
});

app.get("/api/assignments", requireAuth, async (request, response) => {
	try {
		const username = request.session.username;
		return response.json({
			assignments: await assignmentsForUser(username),
		});
	} catch (error) {
		console.error(error);
		return response
			.status(500)
			.json({ error: "The request could not be completed." });
	}
});

app.post("/api/assignments", requireAuth, async (request, response) => {
	try {
		const username = request.session.username;
		const cleaned = validate(request.body);
		await assignments.insertOne({
			id: crypto.randomUUID(),
			username,
			...cleaned,
		});
		return response
			.status(201)
			.json({ assignments: await assignmentsForUser(username) });
	} catch (error) {
		console.error(error);
		return response.status(400).json({
			error: error.message || "The request could not be completed.",
		});
	}
});

app.put("/api/assignments/:id", requireAuth, async (request, response) => {
	try {
		const username = request.session.username;
		const cleaned = validate(request.body);
		const result = await assignments.updateOne(
			{ id: request.params.id, username },
			{ $set: cleaned },
		);
		if (result.matchedCount === 0) {
			return response
				.status(404)
				.json({ error: "Assignment not found." });
		}
		return response.json({
			assignments: await assignmentsForUser(username),
		});
	} catch (error) {
		console.error(error);
		return response.status(400).json({
			error: error.message || "The request could not be completed.",
		});
	}
});

app.delete("/api/assignments/:id", requireAuth, async (request, response) => {
	try {
		const username = request.session.username;
		const result = await assignments.deleteOne({
			id: request.params.id,
			username,
		});
		if (result.deletedCount === 0) {
			return response
				.status(404)
				.json({ error: "Assignment not found." });
		}
		return response.json({
			assignments: await assignmentsForUser(username),
		});
	} catch (error) {
		console.error(error);
		return response
			.status(500)
			.json({ error: "The request could not be completed." });
	}
});

app.use("/api", (request, response) => {
	return response.status(404).json({ error: "API route not found." });
});

const start = async () => {
	await client.connect();
	const db = client.db("dueSoon");
	users = db.collection("users");
	assignments = db.collection("assignments");
	ViteExpress.listen(app, port, () => {
		console.log("Due Soon is running on port " + port);
	});
};

start().catch((error) => {
	console.error(error);
	process.exit(1);
});
