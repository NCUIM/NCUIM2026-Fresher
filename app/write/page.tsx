import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { pendingImpressions, writtenImpressions } from "@/lib/score";
import { NavShell } from "@/components/layout/NavShell";
import { WriteQueue } from "@/components/forms/WriteQueue";

export default async function WritePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const [pending, written] = await Promise.all([
    pendingImpressions(me.id),
    writtenImpressions(me.id),
  ]);

  // 封存後整頁轉為唯讀：已寫的仍看得到，但不能再新增或修改。
  const frozen = me.event.status !== "ACTIVE";

  return (
    <NavShell>
      <WriteQueue initial={pending} written={written} frozen={frozen} />
    </NavShell>
  );
}
