import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "./api";

// Loads an API path whenever the screen comes into focus.
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api(path);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: fn(s.data) })) };
}
