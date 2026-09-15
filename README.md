## Due Soon | WPI assignment tracker

https://a4-ryan-griffin.onrender.com/

Due Soon is a single-page coursework tracker for WPI assignments. Each logged-in user tracks their own assignments (title, course, due date, estimated hours, priority) with derived days-remaining and urgency, and can add, edit, and delete entries. The server stores the data per user in MongoDB.

### What changed from A3

Re-implemented the entire client in React (built with Vite + vite-express):

- `src/client/App.jsx` defines components: `App`, `Header`, `Footer`, `LoginCard`, `AssignmentTable`, `AssignmentRow`, `AssignmentForm`.
- State uses hooks (`useState`, `useEffect`): auth session, assignment list, `editingId`, and controlled form inputs.
- Frontend and API are served from one Express server via `ViteExpress.listen()`.

### React experience

React improved the development experience for this app. Splitting the vanilla-JS render/form code into `LoginCard`, `AssignmentTable`, and `AssignmentForm` components made state management much clearer than manual DOM updates, and controlled inputs removed a class of form-reset bugs. The only downside is the overhead of a react toolchain. Overall, for a CRUD UI with shared state, React was a net win.
