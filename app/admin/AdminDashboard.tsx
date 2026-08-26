"use client";

import { useState } from "react";

type Participant = {
  id: string;
  nickname: string;
  role: string;
  bio: string | null;
  socialUrl: string | null;
  avatarUrl: string | null;
  team: { number: number } | null;
  _count: {
    scansInitiated: number;
    collections: number;
    impressionsWritten: number;
  };
};

export function AdminDashboard({ initial }: { initial: Participant[] }) {
  const [participants, setParticipants] = useState(initial);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [rescue, setRescue] = useState<{ nickname: string; url: string } | null>(null);

  async function publish() {
    if (!announcement.trim()) return;
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: announcement }),
    });
    setNotice(res.ok ? "公告已發布" : "發布失敗");
    if (res.ok) setAnnouncement("");
  }

  async function issueRescue(p: Participant) {
    const res = await fetch(`/api/admin/participants/${p.id}/rescue`, {
      method: "POST",
    });
    if (!res.ok) {
      setNotice("換發失敗");
      return;
    }
    const data = await res.json();
    setRescue({ nickname: data.nickname, url: data.rescueUrl });
  }

  async function moderate(p: Participant) {
    if (!confirm(`確定要清除「${p.nickname}」的頭像、自我介紹與社群連結？`)) return;
    const res = await fetch(`/api/admin/participants/${p.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAvatar: true, clearBio: true, clearSocialUrl: true }),
    });
    if (!res.ok) {
      setNotice("處理失敗");
      return;
    }
    setParticipants((list) =>
      list.map((x) =>
        x.id === p.id ? { ...x, avatarUrl: null, bio: null, socialUrl: null } : x,
      ),
    );
    setNotice(`已清除 ${p.nickname} 的違規內容`);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">發布公告</h2>
        <textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          rows={3}
          placeholder="例如：集合時間改為下午兩點"
          className="resize-none rounded-lg border border-gray-300 px-3 py-2.5"
        />
        <button
          onClick={publish}
          className="tap-target rounded-lg bg-gray-900 py-3 font-medium text-white"
        >
          發布
        </button>
      </section>

      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </p>
      )}

      {rescue && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {rescue.nickname} 的找回連結
          </p>
          <p className="text-xs break-all text-amber-800">{rescue.url}</p>
          <p className="text-xs text-amber-700">
            請本人在自己的手機上開啟。舊的連結已同時失效。
          </p>
          <button
            onClick={() => setRescue(null)}
            className="tap-target self-start text-sm text-amber-900 underline"
          >
            關閉
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">參與者（{participants.length}）</h2>
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.nickname}</span>
                {p.role === "STAFF" && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">
                    工作人員
                  </span>
                )}
                {p.team && (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-white">
                    第 {p.team.number} 組
                  </span>
                )}
              </div>
              {p.bio && <p className="mt-1 text-xs text-gray-500">{p.bio}</p>}
              <p className="mt-1 text-xs text-gray-400">
                主動掃描 {p._count.scansInitiated}・持有 {p._count.collections}・已撰寫{" "}
                {p._count.impressionsWritten}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => issueRescue(p)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                >
                  協助找回身分
                </button>
                <button
                  onClick={() => moderate(p)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                >
                  清除違規內容
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
