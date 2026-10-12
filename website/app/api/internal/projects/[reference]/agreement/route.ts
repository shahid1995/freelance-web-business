import { ValidationError } from "@/lib/platform/errors";
import { redirectAfterError, redirectWith, requireSessionForAction } from "@/lib/platform/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const returnTo = `/internal/projects/${encodeURIComponent(reference)}/agreement`;
  const { platform, personId } = await requireSessionForAction(request.method, returnTo);

  try {
    const projectId = platform.internal.resolveProjectId(personId, reference);
    const form = await request.formData();
    const intent = form.get("intent");

    if (intent === "create") {
      platform.agreements.createAgreement({
        personId,
        projectId,
        additionalTerms: form.get("additionalTerms"),
      });
      return redirectWith(request, returnTo, { internal: "agreement-created" });
    }

    if (intent === "create-version") {
      platform.agreements.createVersion({
        personId,
        projectId,
        additionalTerms: form.get("additionalTerms"),
      });
      return redirectWith(request, returnTo, { internal: "agreement-version-created" });
    }

    if (intent === "publish") {
      platform.agreements.publishVersion({
        personId,
        projectId,
        versionNumber: form.get("versionNumber"),
      });
      return redirectWith(request, returnTo, { internal: "agreement-version-published" });
    }

    throw new ValidationError("That action is not part of the agreement workspace.");
  } catch (error) {
    return redirectAfterError(error, returnTo, "internal");
  }
}
