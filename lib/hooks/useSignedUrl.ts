"use client";

import { useEffect, useState } from "react";
import { getCachedSignedUrl, getSignedUrl } from "@/lib/storage/signed-urls";
import type { Bucket } from "@/lib/storage/upload";

export function useSignedUrl(bucket: Bucket, path: string | null | undefined) {
  const [state, setState] = useState<{ key: string | null; url: string | null; failed: boolean }>(() => ({
    key: path ?? null,
    url: path ? getCachedSignedUrl(bucket, path) : null,
    failed: false,
  }));

  // Reset synchronously when the path changes (derived state, no effect loop).
  const key = path ?? null;
  if (state.key !== key) {
    setState({ key, url: path ? getCachedSignedUrl(bucket, path) : null, failed: false });
  }

  useEffect(() => {
    if (!path || state.url) return;
    let cancelled = false;
    getSignedUrl(bucket, path).then((url) => {
      if (!cancelled) setState({ key: path, url, failed: !url });
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, path, state.url]);

  return { url: state.url, failed: state.failed };
}
