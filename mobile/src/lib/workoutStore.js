// Hands the chosen workout from the Fitness screen to the player without stuffing it into the URL.
let current = null;
export const setWorkout = (w) => (current = w);
export const getWorkout = () => current;
