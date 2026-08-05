/**
 * Attachments are only ever readable through the authenticated
 * ticket_attachment_download endpoint (see api/attachments.js) — a plain
 * <a href>/<img src> can't attach the JWT bearer header that endpoint
 * requires, so every place that used to link/render attachment.file_url
 * directly needs to go through one of these instead.
 */
import { downloadAttachment } from "../api/attachments";

// Fetches the file and opens it in a new tab — the on-click replacement for
// the old `<a href={file_url} target="_blank">` "View" link. Lazy: only
// downloads when the user actually clicks, same as a real link would.
export async function openAttachment(ticketId, attachment) {
  const { data } = await downloadAttachment(ticketId, attachment.id);
  const blobUrl = URL.createObjectURL(data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  // Give the new tab time to actually load the blob before revoking it.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
