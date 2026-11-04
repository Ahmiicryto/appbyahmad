import { fmt } from "../api.js";
import { useApi } from "../useApi.js";

// Plain-language names for activity event types. Unknown types fall back to the raw name.
export const ACTIVITY_LABELS = {
  "auth.registered": "Signed up",
  "auth.signed_in": "Signed in",
  "onboarding.completed": "Finished onboarding",
  "profile.theme_changed": "Changed theme",
  "goal.created": "Created a goal",
  "goal.status_changed": "Changed a goal's status",
  "goal.deleted": "Deleted a goal",
  "milestone.updated": "Updated a milestone",
  "task.created": "Added a task",
  "task.completed": "Completed a task",
  "journal.entry_created": "Wrote a journal entry"
};

export const activityLabel = (type) => ACTIVITY_LABELS[type] ?? type;

// Meta only ever holds ids, categories, counts and sources, so it is safe to show.
export function describeMeta(meta) {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

// Card listing one user's latest 100 activity events. Place on the user detail page.
export function UserActivity({ userId }) {
  const { data, error, loading } = useApi(`/admin/activity/user/${userId}`);

  return (
    <section className="card" style={{ padding: 0 }}>
      <h2 style={{ padding: "18px 18px 0" }}>Recent activity</h2>
      {error && <div className="error" style={{ margin: 18 }}>{error.message}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>What</th><th>Details</th><th>When</th></tr></thead>
          <tbody>
            {data?.events.map((e) => (
              <tr key={e.id}>
                <td>{activityLabel(e.type)}</td>
                <td className="muted">{describeMeta(e.meta) || "—"}</td>
                <td title={fmt.dateTime(e.created_at)}>{fmt.ago(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.events.length && (
          <p className="empty">No activity yet. Sign-ins, goals, tasks and journal entries will show here as this user uses the app.</p>
        )}
        {loading && !data && <p className="empty">Loading…</p>}
      </div>
    </section>
  );
}
