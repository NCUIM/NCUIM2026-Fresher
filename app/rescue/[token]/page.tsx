import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session";

/**
 * 工作人員協助找回身分時開啟的網址。
 * token 由後台換發，開啟即把身分綁到這台裝置的瀏覽器上。
 */
export const dynamic = "force-dynamic";

export default async function RescuePage(props: PageProps<"/rescue/[token]">) {
  const { token } = await props.params;

  const participant = await prisma.participant.findUnique({
    where: { sessionToken: token },
    select: { id: true },
  });

  if (!participant) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="text-lg font-bold">連結已失效</h1>
        <p className="text-sm text-gray-500">
          請再向工作人員索取一次新的連結。
        </p>
      </main>
    );
  }

  await setSessionCookie(token);
  redirect("/me");
}
