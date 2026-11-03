import { query } from "../db/pool.js";

export function audit(actorId, action, targetType, targetId, details = {}) {
  return query("INSERT INTO audit_log (actor_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)", [
    actorId,
    action,
    targetType,
    targetId == null ? null : String(targetId),
    details
  ]);
}
