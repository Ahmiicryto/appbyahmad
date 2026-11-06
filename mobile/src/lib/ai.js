import { api } from "./api";

// Error codes from /api/ai that the screens show differently.
export const isUpgradeError = (err) => err?.status === 402 && err?.code === "ai_limit";
export const isAiOff = (err) => err?.code === "ai_unavailable";

export const planDay = () => api("/ai/plan-day", { method: "POST" });
export const reflectOn = (id) => api(`/ai/journal/${id}/reflect`, { method: "POST" });
export const getWeeklyReview = () => api("/ai/weekly-review");
export const makeWeeklyReview = () => api("/ai/weekly-review", { method: "POST" });
