import { router } from "expo-router";

// One navigation at a time: a fast double tap can't open the same screen twice.
const LOCK_MS = 600;
let lockedUntil = 0;

function locked() {
  const now = Date.now();
  if (now < lockedUntil) return true;
  lockedUntil = now + LOCK_MS;
  return false;
}

export function go(href) {
  if (!locked()) router.push(href);
}

export function back() {
  if (locked()) return;
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function swap(href) {
  if (!locked()) router.replace(href);
}
