import type { Notice } from "@/lib/platform/notices";

/**
 * Renders an approved customer notice.
 *
 * The message is always one of the strings in `notices.ts`, so this component
 * cannot render a raw query-string code or a service error message. Error
 * notices are announced as alerts and confirmations as status updates.
 *
 * Shared by every portal page so the styling and the announcement semantics stay
 * in step with the single source of approved wording.
 */
export function PortalNotice({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }
  return (
    <p
      className={
        notice.kind === "error" ? "form-notice form-notice--error" : "form-notice"
      }
      role={notice.kind === "error" ? "alert" : "status"}
    >
      {notice.message}
    </p>
  );
}