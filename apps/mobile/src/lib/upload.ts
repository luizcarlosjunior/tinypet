import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { AVATAR_PX, GALLERY_MAX_PX, MEDIA_MAX_BYTES } from "@tinypet/shared";
import { API_BASE, api, getApiContext } from "./api";
import { extractDefaultCover, prepareCoverSource, cropCover, transcodeVideo, VideoProcessingError, type ProcessedVideo, type VideoCover } from "./video/transcode";

export type MediaPurpose = "PARTNER_LOGO" | "USER_AVATAR" | "PET_AVATAR" | "VENUE_PHOTO" | "PET_GALLERY" | "CATALOG" | "COURSE" | "ATTACHMENT" | "RECEIPT" | "VIDEO_COVER";

export type UploadedMedia = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  kind: "IMAGE" | "VIDEO";
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  durationSeconds?: number | null;
  coverAssetId?: string | null;
};

type UploadTicket = { assetId: string; uploadUrl: string; method: "PUT"; headers?: Record<string, string>; url: string };

/**
 * Dev only: the local upload sink URL is built from the server's APP_URL (e.g. http://localhost:3033), which a
 * device/emulator can't reach (Android emulator uses 10.0.2.2). Rebase a loopback `/api/v1/media/upload/…` URL onto
 * the API origin the app is actually using. Presigned S3 URLs are returned untouched.
 */
function resolveUploadUrl(uploadUrl: string): string {
  if (!__DEV__) return uploadUrl;
  const m = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/api\/v1\/media\/upload\/[^?#]*)$/i.exec(uploadUrl);
  return m ? `${API_BASE}${m[3]!.slice("/api/v1".length)}` : uploadUrl;
}

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

function rawVideoError() {
  return new Error(
    "[upload] Raw videos can't be uploaded with uploadFile()/prepareAsset(): every video must be transcoded on the device first. " +
      "Use processAndUploadVideo() (or transcodeVideo() + uploadProcessedVideo()) from src/lib/upload.ts, or the <VideoUploadSheet /> component.",
  );
}

/** Converts an IMAGE picker asset into a LocalFile ready for upload (resize + JPEG). Videos: see processAndUploadVideo. */
export async function prepareAsset(asset: ImagePicker.ImagePickerAsset, opts: { avatar?: boolean } = {}): Promise<LocalFile | null> {
  if (asset.type === "video") throw rawVideoError();
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

/** 3-step upload for IMAGES/documents: request ticket → PUT bytes → complete. Videos: processAndUploadVideo(). */
export async function uploadFile(file: LocalFile, purpose: MediaPurpose, opts: { partnerId?: string | null; crop?: { x: number; y: number; width: number; height: number } } = {}): Promise<UploadedMedia> {
  if (file.kind === "VIDEO" || file.mimeType.startsWith("video/")) throw rawVideoError();
  // Read the bytes first so the declared size is exact (S3 presigned PUTs sign Content-Length).
  const blob = await fetch(file.uri).then((r) => r.blob());
  const ticket = await api<UploadTicket>("/media/upload", {
    method: "POST",
    partnerId: opts.partnerId,
    json: {
      purpose,
      mimeType: file.mimeType,
      sizeBytes: blob.size || file.sizeBytes,
      fileName: file.fileName,
      width: file.width,
      height: file.height,
    },
  });
  // The local-dev sink lives on our API and needs the Bearer token; never send it to third-party (S3) URLs.
  const { token } = getApiContext();
  const uploadUrl = resolveUploadUrl(ticket.uploadUrl);
  const toOwnApi = uploadUrl.startsWith(`${API_BASE}/`);
  const put = await fetch(uploadUrl, {
    method: ticket.method ?? "PUT",
    headers: { "Content-Type": file.mimeType, ...(ticket.headers ?? {}), ...(toOwnApi && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: blob,
  });
  if (!put.ok) throw new Error(`Falha ao enviar arquivo (${put.status})`);
  return api<UploadedMedia>("/media/complete", { method: "POST", partnerId: opts.partnerId, json: { assetId: ticket.assetId, ...(opts.crop ? { crop: opts.crop } : {}) } });
}

/** Opens the picker (images only; square crop for avatars) and uploads. Returns null when cancelled or rejected. Videos: <VideoUploadSheet />. */
export async function pickAndUpload(purpose: MediaPurpose, opts: { avatar?: boolean; camera?: boolean } = {}): Promise<UploadedMedia | null> {
  const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permissão necessária", opts.camera ? "Permita o acesso à câmera nas configurações." : "Permita o acesso às fotos nas configurações.");
    return null;
  }
  const common: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
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

// ───────── videos ─────────

/** GET /media/limits — per-plan daily video quota and max duration for the upload context. */
export type MediaLimits = {
  audience: "OWNER" | "PARTNER";
  planKey: string | null;
  videosPerDay: number | null;
  videosUsedToday: number;
  videoMaxSeconds: number | null;
  maxBytes: number;
};

/** `partnerId`: send the partner id for partner-context uploads, `null` for tutor (owner) uploads. */
export function fetchMediaLimits(partnerId: string | null): Promise<MediaLimits> {
  return api<MediaLimits>("/media/limits", { partnerId });
}

export type VideoUploadPhase = "transcoding" | "cover" | "uploading" | "finalizing";
export type VideoUploadProgress = { phase: VideoUploadPhase; progress: number };

export type VideoUploadOptions = {
  /** X-Partner-Id for the upload calls: partner id (partner context), `null` (tutor), undefined (current app context). */
  partnerId?: string | null;
  onProgress?: (p: VideoUploadProgress) => void;
  signal?: AbortSignal;
};

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new VideoProcessingError("CANCELLED", "Envio cancelado.");
}

async function exactSize(uri: string): Promise<number> {
  const size = await fileSize(uri);
  if (!size) throw new Error("Arquivo local não encontrado para envio");
  return size;
}

/** PUT a local file to the presigned URL with progress + cancel (streams from disk; Content-Length = file size). */
async function putFile(ticket: UploadTicket, fileUri: string, mimeType: string, onProgress?: (p: number) => void, signal?: AbortSignal) {
  const { token } = getApiContext();
  const uploadUrl = resolveUploadUrl(ticket.uploadUrl);
  const toOwnApi = uploadUrl.startsWith(`${API_BASE}/`);
  const task = FileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": mimeType, ...(ticket.headers ?? {}), ...(toOwnApi && token ? { Authorization: `Bearer ${token}` } : {}) },
    },
    (e) => {
      if (e.totalBytesExpectedToSend > 0) onProgress?.(Math.min(1, e.totalBytesSent / e.totalBytesExpectedToSend));
    },
  );
  const onAbort = () => {
    task.cancelAsync().catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await task.uploadAsync();
    aborted(signal);
    if (!res) throw new VideoProcessingError("CANCELLED", "Envio cancelado.");
    if (res.status < 200 || res.status >= 300) throw new Error(`Falha ao enviar arquivo (${res.status})`);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Uploads the cover as a VIDEO_COVER image. The cover is ALREADY cropped on the device to the video aspect
 * (exact 1280×720 / 720×1280); we still send a full-frame `crop` rect so the server's "crop must be 16:9 or 9:16
 * in source pixels" rule is satisfied without the server re-cropping anything.
 */
export async function uploadVideoCover(cover: VideoCover, opts: VideoUploadOptions = {}): Promise<UploadedMedia> {
  aborted(opts.signal);
  const sizeBytes = await exactSize(cover.uri);
  const ticket = await api<UploadTicket>("/media/upload", {
    method: "POST",
    partnerId: opts.partnerId,
    json: { purpose: "VIDEO_COVER", mimeType: "image/jpeg", sizeBytes, fileName: "capa.jpg", width: cover.width, height: cover.height },
  });
  await putFile(ticket, cover.uri, "image/jpeg", undefined, opts.signal);
  return api<UploadedMedia>("/media/complete", {
    method: "POST",
    partnerId: opts.partnerId,
    json: { assetId: ticket.assetId, crop: { x: 0, y: 0, width: cover.width, height: cover.height } },
  });
}

/** Uploads an already-transcoded MP4 (see transcodeVideo) with its cover: cover → ticket → PUT → complete { coverAssetId }. */
export async function uploadProcessedVideo(video: ProcessedVideo, cover: VideoCover, purpose: MediaPurpose, opts: VideoUploadOptions = {}): Promise<UploadedMedia> {
  const { onProgress, signal } = opts;
  aborted(signal);
  onProgress?.({ phase: "cover", progress: 0 });
  const coverAsset = await uploadVideoCover(cover, opts);
  aborted(signal);
  const sizeBytes = await exactSize(video.uri);
  const ticket = await api<UploadTicket>("/media/upload", {
    method: "POST",
    partnerId: opts.partnerId,
    json: {
      purpose,
      mimeType: video.mimeType,
      sizeBytes,
      fileName: "video.mp4",
      width: video.width,
      height: video.height,
      durationSeconds: video.durationSeconds,
    },
  });
  onProgress?.({ phase: "uploading", progress: 0 });
  await putFile(ticket, video.uri, video.mimeType, (p) => onProgress?.({ phase: "uploading", progress: p }), signal);
  onProgress?.({ phase: "finalizing", progress: 1 });
  return api<UploadedMedia>("/media/complete", { method: "POST", partnerId: opts.partnerId, json: { assetId: ticket.assetId, coverAssetId: coverAsset.id } });
}

/**
 * Full pipeline for a picked video, without UI: transcode on the device (VIDEO_OUTPUT) → cover (given image,
 * center-cropped to the video aspect, or a frame at ~1 s of the output) → upload cover (VIDEO_COVER) → upload MP4
 * (exact width/height/durationSeconds/sizeBytes) → complete with coverAssetId.
 * `maxDurationSeconds` + `trimToMax`: plan duration limit (keep the first N seconds).
 */
export async function processAndUploadVideo(
  uri: string,
  purpose: MediaPurpose,
  opts: VideoUploadOptions & { coverUri?: string; maxDurationSeconds?: number | null; trimToMax?: boolean } = {},
): Promise<UploadedMedia> {
  const { onProgress, signal } = opts;
  const video = await transcodeVideo(uri, {
    maxDurationSeconds: opts.maxDurationSeconds,
    trimToMax: opts.trimToMax,
    signal,
    onProgress: (p) => onProgress?.({ phase: "transcoding", progress: p }),
  });
  try {
    let cover: VideoCover;
    if (opts.coverUri) {
      const src = await prepareCoverSource(opts.coverUri);
      cover = await cropCover(src, centerCropRect(src.width, src.height, video.orientation === "landscape" ? 16 / 9 : 9 / 16), video.orientation);
    } else {
      cover = await extractDefaultCover(video);
    }
    return await uploadProcessedVideo(video, cover, purpose, opts);
  } finally {
    FileSystem.deleteAsync(video.uri, { idempotent: true }).catch(() => undefined);
  }
}

/** Largest centered rect with the given aspect (w/h) inside a w×h image, in source pixels. */
export function centerCropRect(w: number, h: number, aspect: number) {
  let width = w;
  let height = Math.round(w / aspect);
  if (height > h) {
    height = h;
    width = Math.round(h * aspect);
  }
  return { originX: Math.floor((w - width) / 2), originY: Math.floor((h - height) / 2), width, height };
}
