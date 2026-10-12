import { agreementSignNoticeCodeFor } from "@/lib/platform/notices";
import { redirectWith, requireSessionForAction } from "@/lib/platform/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const returnTo = `/dashboard/projects/${encodeURIComponent(reference)}/agreement`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    const projectId = platform.projects.resolveProjectIdByReference(personId, reference);
    const form = await request.formData();
    platform.customerAgreements.sign({
      personId,
      projectId,
      versionNumber: form.get("versionNumber"),
      actionKey: form.get("actionKey"),
    });
    return redirectWith(request, returnTo, { sent: "agreement-signed" });
  } catch (error) {
    return redirectWith(request, returnTo, { error: agreementSignNoticeCodeFor(error) });
  }
}
