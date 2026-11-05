import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// Opens the camera or photo library, crops to a square, shrinks to 320px and returns a small JPEG data URL
// (about 20–40 KB) that the server stores as the profile photo. Returns null if cancelled.
export async function pickAvatar(source) {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera access is off. Turn it on in your phone's Settings to take a photo.");
  }
  const opts = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const ctx = ImageManipulator.manipulate(result.assets[0].uri);
  ctx.resize({ width: 320, height: 320 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!out.base64) throw new Error("Couldn't read that photo. Try another one.");
  const dataUrl = `data:image/jpeg;base64,${out.base64}`;
  if (dataUrl.length > 150_000) throw new Error("That photo is too large. Try another one.");
  return dataUrl;
}
