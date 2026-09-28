import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { AVATAR_PX, GALLERY_MAX_PX, MEDIA_MAX_BYTES } from "@tinypet/shared";
import { API_BASE, api, getApiContext } from "./api";

export type MediaPurpose = "PARTNER_LOGO" | "USER_AVATAR" | "PET_AVATAR" | "VENUE_PHOTO" | "PET_GALLERY" | "CATALOG" | "COURSE" | "ATTACHMENT" | "RECEIPT";

export type UploadedMedia = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  kind: "IMAGE" | "VIDEO";
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
};

type UploadTicket = { assetId: string; uploadUrl: string; method: "PUT"; headers?: Record<string, string>; url: string };

export type LocalFile = {
  uri: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  kind: "IMAGE" | "VIDEO";
};

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
  } catch {
    return 0;
  }
}

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("mp4")) return "mp4";
  return "jpg";
}

/** Resize an image to `maxPx` on the longest side and JPEG-compress it (≤ 10 MB). */
export async function compressImage(uri: string, width?: number, height?: number, maxPx = GALLERY_MAX_PX): Promise<{ uri: string; width: number; height: number }> {
  const longest = Math.max(width ?? 0, height ?? 0);
  const actions: { resize: { width?: number; height?: number } }[] = [];
  if (longest > maxPx) {
    actions.push((width ?? 0) >= (height ?? 0) ? { resize: { width: maxPx } } : { resize: { height: maxPx } });
  }
  const out = await manipulateAsync(uri, actions, { compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Square-crop + resize to 512px for avatars (picker already cropped square with allowsEditing). */
export async function prepareAvatar(uri: string, width?: number, height?: number): Promise<{ uri: string; width: number; height: number }> {
  const w = width ?? 0;
  const h = height ?? 0;
  const actions: Parameters<typeof manipulateAsync>[1] = [];
  if (w && h && w !== h) {
    const side = Math.min(w, h);
    actions.push({ crop: { originX: Math.floor((w - side) / 2), originY: Math.floor((h - side) / 2), width: side, height: side } });
  }
  actions.push({ resize: { width: AVATAR_PX, height: AVATAR_PX } });
  const out = await manipulateAsync(uri, actions, { compress: 0.85, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Converts a picker asset into a LocalFile ready for upload (compresses images, validates video size). */
export async function prepareAsset(asset: ImagePicker.ImagePickerAsset, opts: { avatar?: boolean } = {}): Promise<LocalFile | null> {
  const isVideo = asset.type === "video";
  if (isVideo) {
    const size = asset.fileSize ?? (await fileSize(asset.uri));
    // No video compression library is bundled (documented limitation): reject videos over 10 MB.
    if (size > MEDIA_MAX_BYTES) {
      Alert.alert("Vídeo acima de 10 MB", "Escolha um vídeo menor ou reduza a qualidade antes de enviar.");
      return null;
    }
    const mime = asset.mimeType ?? "video/mp4";
    return {
      uri: asset.uri,
      mimeType: mime,
      fileName: asset.fileName ?? `video.${extFromMime(mime)}`,
      sizeBytes: size,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.duration ? asset.duration / 1000 : undefined,
      kind: "VIDEO",
    };
  }
  const out = opts.avatar ? await prepareAvatar(asset.uri, asset.width, asset.height) : await compressImage(asset.uri, asset.width, asset.height);
  let size = await fileSize(out.uri);
  let uri = out.uri;
  // Extremely rare after resize, but keep re-compressing until under the cap.
  let quality = 0.6;
  while (size > MEDIA_MAX_BYTES && quality >= 0.3) {
    const again = await manipulateAsync(uri, [], { compress: quality, format: SaveFormat.JPEG });
    uri = again.uri;
    size = await fileSize(uri);
    quality -= 0.15;
  }
  if (size > MEDIA_MAX_BYTES) {
    Alert.alert("Imagem muito grande", "Não foi possível reduzir a imagem para menos de 10 MB.");
    return null;
  }
  return { uri, mimeType: "image/jpeg", fileName: (asset.fileName ?? "foto").replace(/\.\w+$/, "") + ".jpg", sizeBytes: size || 1, width: out.width, height: out.height, kind: "IMAGE" };
}

/** 3-step upload: request ticket → PUT bytes → complete. */
export async function uploadFile(file: LocalFile, purpose: MediaPurpose): Promise<UploadedMedia> {
  // Read the bytes first so the declared size is exact (S3 presigned PUTs sign Content-Length).
  const blob = await fetch(file.uri).then((r) => r.blob());
  const ticket = await api<UploadTicket>("/media/upload", {
    method: "POST",
    json: {
      purpose,
      mimeType: file.mimeType,
      sizeBytes: blob.size || file.sizeBytes,
      fileName: file.fileName,
      width: file.width,
      height: file.height,
      durationSeconds: file.durationSeconds,
    },
  });
  // The local-dev sink lives on our API and needs the Bearer token; never send it to third-party (S3) URLs.
  const { token } = getApiContext();
  const toOwnApi = ticket.uploadUrl.startsWith(`${API_BASE}/`);
  const put = await fetch(ticket.uploadUrl, {
    method: ticket.method ?? "PUT",
    headers: { "Content-Type": file.mimeType, ...(ticket.headers ?? {}), ...(toOwnApi && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: blob,
  });
  if (!put.ok) throw new Error(`Falha ao enviar arquivo (${put.status})`);
  return api<UploadedMedia>("/media/complete", { method: "POST", json: { assetId: ticket.assetId } });
}

/** Opens the picker (square crop for avatars) and uploads. Returns null when cancelled or rejected. */
export async function pickAndUpload(purpose: MediaPurpose, opts: { avatar?: boolean; allowVideo?: boolean; camera?: boolean } = {}): Promise<UploadedMedia | null> {
  const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permissão necessária", opts.camera ? "Permita o acesso à câmera nas configurações." : "Permita o acesso às fotos nas configurações.");
    return null;
  }
  const common: ImagePicker.ImagePickerOptions = {
    mediaTypes: opts.allowVideo ? ["images", "videos"] : ["images"],
    allowsEditing: !!opts.avatar,
    aspect: opts.avatar ? [1, 1] : undefined,
    quality: 1,
    exif: false,
  };
  const result = opts.camera ? await ImagePicker.launchCameraAsync(common) : await ImagePicker.launchImageLibraryAsync(common);
  if (result.canceled || !result.assets[0]) return null;
  const file = await prepareAsset(result.assets[0], { avatar: opts.avatar });
  if (!file) return null;
  return uploadFile(file, purpose);
}
