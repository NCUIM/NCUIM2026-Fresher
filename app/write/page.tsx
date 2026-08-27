import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { pendingImpressions } from "@/lib/score";
import { NavShell } from "@/components/layout/BottomNav";
import { WriteQueue } from "@/components/forms/WriteQueue";

export default async function WritePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const pending = await pendingImpressions(me.id);

  return (
    <NavShell>
      <WriteQueue initial={pending} />
    </NavShell>
  );
}
