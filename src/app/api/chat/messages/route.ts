import { NextResponse } from "next/server";

import { db } from "@/db";
import { teamMessages } from "@/db/schema";
import {
  getTeamChatMessages,
  getUnreadChatCount,
  markTeamChatRead,
} from "@/db/queries/team-chat";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/roles";

const MAX_BODY = 2000;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const afterId = Number(url.searchParams.get("after") ?? "0");
  const markRead = url.searchParams.get("markRead") === "1";

  const [messages, unread] = await Promise.all([
    getTeamChatMessages({
      viewerUserId: session.userId,
      afterId: Number.isFinite(afterId) && afterId > 0 ? afterId : undefined,
    }),
    getUnreadChatCount(session.userId),
  ]);

  if (markRead && messages.length > 0) {
    const latestId = messages[messages.length - 1]!.id;
    await markTeamChatRead(session.userId, latestId);
  }

  return NextResponse.json({
    messages,
    unreadCount: markRead ? 0 : unread.unreadCount,
    lastReadMessageId: unread.lastReadMessageId,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { body?: string; isAnnouncement?: boolean };
  try {
    body = (await request.json()) as { body?: string; isAnnouncement?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_BODY} characters).` },
      { status: 400 },
    );
  }

  const isAnnouncement = Boolean(body.isAnnouncement) && isAdmin(session.role);

  const [inserted] = await db
    .insert(teamMessages)
    .values({
      senderUserId: session.userId,
      body: text,
      isAnnouncement,
    })
    .returning({
      id: teamMessages.id,
      createdAt: teamMessages.createdAt,
    });

  if (!inserted) {
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }

  await markTeamChatRead(session.userId, inserted.id);

  return NextResponse.json({
    message: {
      id: inserted.id,
      senderUserId: session.userId,
      senderName: session.name ?? session.email,
      body: text,
      isAnnouncement,
      createdAt: inserted.createdAt.toISOString(),
      isOwn: true,
    },
  });
}
