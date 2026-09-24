import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type Bucket = "chat-images" | "memories" | "avatars";

export class UploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/**
 * Uploads to Supabase Storage with progress events. supabase-js has no
 * progress callback, so this calls the documented Storage REST endpoint with
 * XMLHttpRequest and the user's own access token. RLS still applies.
 */
export async function uploadWithProgress(
  bucket: Bucket,
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
  opts: { upsert?: boolean; signal?: AbortSignal } = {},
): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UploadError("Not signed in", 401);

  const { url, key } = getSupabaseEnv();
  const endpoint = `${url}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", opts.upsert ? "true" : "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      // 409 = already uploaded by an earlier attempt of this same message.
      if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 409 && !opts.upsert)) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(`Upload failed (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError("Network error during upload"));
    xhr.onabort = () => reject(new UploadError("Upload cancelled"));
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}
