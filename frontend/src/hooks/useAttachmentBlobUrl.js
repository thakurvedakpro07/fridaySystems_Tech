import { useEffect, useState } from "react";
import { downloadAttachment } from "../api/attachments";

/**
 * Eagerly downloads an attachment through the authenticated endpoint and
 * exposes it as a local blob: URL, for the cases that need to *render*
 * the file rather than just link to it (inline image thumbnails, the image
 * lightbox, the text-file preview) — a plain <img src={file_url}> can't
 * attach the auth header the download endpoint requires.
 *
 * enabled lets callers skip the fetch entirely for attachment types they
 * don't render inline (e.g. only fetch for images/text-like files).
 */
export default function useAttachmentBlobUrl(ticketId, attachment, enabled = true) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !ticketId || !attachment?.id) return undefined;
    let cancelled = false;
    let objectUrl = null;

    downloadAttachment(ticketId, attachment.id)
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ticketId, attachment?.id, enabled]);

  return { blobUrl, error };
}
