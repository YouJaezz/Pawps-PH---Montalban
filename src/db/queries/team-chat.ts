import { cache } from "react";
import { desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { teamChatReads, teamMessages, users } from "@/db/schema";

export type TeamChatMessage = {
  id: number;
  senderUserId: number;
  senderName: string;
  body: string;
  isAnnouncement: boolean;
  createdAt: string;
  isOwn: boolean;
};

export async function getTeamChatMessages(opts: {
  viewerUserId: number;
  afterId?: number;
  limit?: number;
}) {
  const limit = opts.limit ?? 80;
  const afterId = opts.afterId ?? 0;

  const rows = await db
    .select({
      id: teamMessages.id,
      senderUserId: teamMessages.senderUserId,
      body: teamMessages.body,
      isAnnouncement: teamMessages.isAnnouncement,
      createdAt: teamMessages.createdAt,
      senderName: users.name,
      senderEmail: users.email,
    })
    .from(teamMessages)
    .leftJoin(users, eq(teamMessages.senderUserId, users.id))
    .where(afterId > 0 ? gt(teamMessages.id, afterId) : sql`1=1`)
    .orderBy(desc(teamMessages.id))
    .limit(limit);

  const chronological = rows.reverse();

  return chronological.map((r) => ({
    id: r.id,
    senderUserId: r.senderUserId,
    senderName: r.senderName ?? r.senderEmail ?? "Staff",
    body: r.body,
    isAnnouncement: r.isAnnouncement,
    createdAt: r.createdAt.toISOString(),
    isOwn: r.senderUserId === opts.viewerUserId,
  }));
}

export async function getUnreadChatCount(userId: number) {
  const [readRow] = await db
    .select({ lastReadMessageId: teamChatReads.lastReadMessageId })
    .from(teamChatReads)
    .where(eq(teamChatReads.userId, userId))
    .limit(1);

  const lastRead = readRow?.lastReadMessageId ?? 0;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMessages)
    .where(gt(teamMessages.id, lastRead));

  return {
    unreadCount: Number(countRow?.count ?? 0),
    lastReadMessageId: lastRead,
  };
}

export async function markTeamChatRead(userId: number, lastReadMessageId: number) {
  await db
    .insert(teamChatReads)
    .values({
      userId,
      lastReadMessageId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: teamChatReads.userId,
      set: {
        lastReadMessageId,
        updatedAt: new Date(),
      },
    });
}

export const getLatestMessageId = cache(async () => {
  const [row] = await db
    .select({ id: teamMessages.id })
    .from(teamMessages)
    .orderBy(desc(teamMessages.id))
    .limit(1);
  return row?.id ?? 0;
});
