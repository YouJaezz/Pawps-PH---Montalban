"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { ChatToastStack, type ChatToastItem } from "@/components/ChatToastStack";
import { TeamChatWidget } from "@/components/TeamChatWidget";
import type { TeamChatMessage } from "@/db/queries/team-chat";
import {
  playChatMessageSound,
  requestChatNotificationPermission,
  showChatBrowserNotification,
  truncateChatPreview,
  unlockChatAudio,
} from "@/lib/chat-notify";

type TeamChatContextValue = {
  unreadCount: number;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  notifyMessagesSeen: () => void;
};

const TeamChatContext = createContext<TeamChatContextValue | null>(null);

export function useTeamChat() {
  const ctx = useContext(TeamChatContext);
  return ctx;
}

export function TeamChatNotifier(props: {
  userId: number;
  userName: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpenState] = useState(false);
  const [toasts, setToasts] = useState<ChatToastItem[]>([]);
  const lastIdRef = useRef(0);
  const bootstrappedRef = useRef(false);
  const chatOpenRef = useRef(false);
  const pathname = usePathname();
  const onChatPage =
    pathname === "/team-chat" || pathname.startsWith("/team-chat/");

  const setChatOpen = useCallback((open: boolean) => {
    chatOpenRef.current = open;
    setChatOpenState(open);
    if (open) {
      unlockChatAudio();
      void requestChatNotificationPermission();
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifyIncoming = useCallback(
    (messages: TeamChatMessage[]) => {
      const viewingChat =
        chatOpenRef.current || (onChatPage && !document.hidden);

      for (const m of messages) {
        if (m.isOwn) continue;

        if (!viewingChat) {
          playChatMessageSound();
        } else if (document.hidden) {
          playChatMessageSound();
        }

        if (!viewingChat || document.hidden) {
          setToasts((prev) => {
            if (prev.some((t) => t.id === m.id)) return prev;
            return [
              ...prev.slice(-2),
              {
                id: m.id,
                senderName: m.senderName,
                body: truncateChatPreview(m.body),
                isAnnouncement: m.isAnnouncement,
              },
            ];
          });
        }

        if (document.hidden || !viewingChat) {
          showChatBrowserNotification({
            title: m.isAnnouncement
              ? `${m.senderName} · Announcement`
              : `New message from ${m.senderName}`,
            body: m.body,
            tag: `chat-${m.id}`,
            onClick: () => setChatOpen(true),
          });
        }
      }
    },
    [onChatPage, setChatOpen],
  );

  const poll = useCallback(async () => {
    try {
      const afterId = bootstrappedRef.current ? lastIdRef.current : 0;
      const qs = new URLSearchParams();
      if (afterId > 0) qs.set("after", String(afterId));
      if (chatOpenRef.current) qs.set("markRead", "1");
      if (onChatPage) qs.set("markRead", "1");

      const res = await fetch(`/api/chat/messages?${qs.toString()}`);
      if (!res.ok) return;

      const data = (await res.json()) as {
        messages: TeamChatMessage[];
        unreadCount: number;
      };

      if (data.messages.length > 0) {
        const maxId = Math.max(...data.messages.map((m) => m.id));
        lastIdRef.current = maxId;

        if (bootstrappedRef.current && afterId > 0) {
          notifyIncoming(data.messages);
        }
      }

      bootstrappedRef.current = true;
      setUnreadCount(
        chatOpenRef.current || onChatPage ? 0 : data.unreadCount,
      );
    } catch {
      /* background poll */
    }
  }, [notifyIncoming, onChatPage]);

  useEffect(() => {
    const initial = window.setTimeout(() => void poll(), 0);
    const id = setInterval(() => void poll(), 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [poll]);

  useEffect(() => {
    const unlock = () => unlockChatAudio();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const notifyMessagesSeen = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <TeamChatContext.Provider
      value={{
        unreadCount,
        chatOpen,
        setChatOpen,
        notifyMessagesSeen,
      }}
    >
      {props.children}
      <ChatToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        onOpen={() => setChatOpen(true)}
      />
      <TeamChatWidget
        userId={props.userId}
        userName={props.userName}
        isAdmin={props.isAdmin}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        unreadCount={unreadCount}
        onMessagesSeen={notifyMessagesSeen}
      />
    </TeamChatContext.Provider>
  );
}

export function UnreadBadge(props: { count: number; className?: string }) {
  if (props.count <= 0) return null;
  return (
    <span
      className={
        props.className ??
        "flex min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"
      }
    >
      {props.count > 99 ? "99+" : props.count}
    </span>
  );
}
