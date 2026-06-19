import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChatAgent } from "@/hooks/useChatAgent";
import { useAgentSessions } from "@/hooks/useAgentSessions";
import { useChatMessages } from "@/hooks/useChatMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Headphones, Send, X, LogOut, Circle, Clock,
  User, Bot, Loader2, Volume2, VolumeX, ArrowLeft,
} from "lucide-react";

function playBeep(frequency: number, duration: number, volume = 0.15) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch { /* AudioContext unavailable */ }
}

function formatTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function AgentDashboard() {
  const { user, loading: authLoading, isAgent, isSuperAdmin, isManager, isChatSupport, signOut } = useAuth();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [closing, setClosing] = useState(false);
  // Mobile: "list" shows the sessions panel, "chat" shows the conversation panel
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const { agentId, isOnline, loading: agentLoading, logout: agentLogout } = useChatAgent();
  const { sessions, loading: sessionsLoading, unreadMap, lastMsgMap, markViewed, acceptChat, closeChat } =
    useAgentSessions(agentId, activeId);
  const { messages, loading: msgsLoading, insertMessage } = useChatMessages(activeId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLInputElement>(null);
  const prevWaitingCount = useRef(0);
  const prevMsgCount = useRef(0);
  const soundEnabled = useRef(true);
  const [isSoundOn, setIsSoundOn] = useState(true);

  const toggleSound = useCallback(() => {
    soundEnabled.current = !soundEnabled.current;
    setIsSoundOn(s => !s);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const active = sessions.find(s => s.id === activeId);
    if (active?.status === "active") replyRef.current?.focus();
  }, [activeId, sessions]);

  useEffect(() => {
    const waiting = sessions.filter(s => s.status === "waiting").length;
    if (soundEnabled.current && waiting > prevWaitingCount.current) {
      playBeep(520, 0.12);
      setTimeout(() => playBeep(660, 0.15), 130);
    }
    prevWaitingCount.current = waiting;
  }, [sessions]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const newest = messages[messages.length - 1];
      if (soundEnabled.current && newest?.sender_type === "user") playBeep(440, 0.1, 0.1);
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  // If the active session disappears from the list (accepted by another agent), deselect it
  useEffect(() => {
    if (activeId && !sessions.some(s => s.id === activeId)) {
      setActiveId(null);
      setMobileView("list");
      toast.info("This chat was accepted by another agent.");
    }
  }, [sessions, activeId]);

  if (authLoading || agentLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/agent/login" replace />;
  if (!isAgent && !isSuperAdmin && !isManager && !isChatSupport) return <Navigate to="/agent/login" replace />;

  const activeSession = sessions.find(s => s.id === activeId) ?? null;
  const waitingCount = sessions.filter(s => s.status === "waiting").length;
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);
  // Only the agent who accepted the chat can reply
  const isMyActiveChat = activeSession?.status === "active" && activeSession?.agent_id === agentId;

  function handleSelect(id: string) {
    setActiveId(id);
    markViewed(id);
    setMobileView("chat");
  }

  function handleBack() {
    setMobileView("list");
  }

  async function handleAccept() {
    if (!activeId || !user) return;
    setAccepting(true);
    try {
      await acceptChat(activeId, user.id);
      toast.success("Chat accepted");
      replyRef.current?.focus();
    } catch { /* error toast handled in hook */ } finally {
      setAccepting(false);
    }
  }

  async function handleClose() {
    if (!activeId) return;
    setClosing(true);
    try {
      await closeChat(activeId);
      toast.success("Chat closed");
      setActiveId(null);
      setMobileView("list");
    } catch { /* error toast handled in hook */ } finally {
      setClosing(false);
    }
  }

  async function handleSend() {
    const text = reply.trim();
    if (!text || !activeId || !user || !isMyActiveChat) return;
    setSending(true);
    try {
      await insertMessage(activeId, "agent", text, user.id);
      setReply("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Sessions list panel ───────────────────────────────────────────────────
  const SessionsList = (
    <aside className={cn(
      "flex flex-col bg-card border-r",
      // Desktop: fixed sidebar; Mobile: full width, shown/hidden by mobileView
      "md:w-72 md:shrink-0 md:flex",
      mobileView === "list" ? "flex w-full" : "hidden md:flex"
    )}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Chats
          {waitingCount > 0 && (
            <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0.5">
              {waitingCount}
            </Badge>
          )}
        </p>
        {sessionsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <ScrollArea className="flex-1">
        {!sessionsLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 px-4">
            <Headphones className="h-8 w-8 opacity-20" />
            <p className="text-sm text-center">No active chats</p>
            <p className="text-xs text-center opacity-70">Waiting for incoming chats...</p>
          </div>
        )}

        {sessions.map(session => {
          const unread = unreadMap[session.id] ?? 0;
          const lastMsg = lastMsgMap[session.id] ?? null;
          const isActive = activeId === session.id;
          const visitorLabel = session.visitor_name ?? "Anonymous Visitor";

          return (
            <button
              key={session.id}
              onClick={() => handleSelect(session.id)}
              className={cn(
                "w-full text-left px-3 py-3 flex items-start gap-3 border-b transition-colors",
                isActive ? "bg-primary/8" : "hover:bg-muted/50"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-sm truncate">{visitorLabel}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatRelative(session.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    session.status === "waiting"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  )}>
                    {session.status === "waiting" ? "Waiting" : "Active"}
                  </span>
                  {session.visitor_email && (
                    <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px]">
                      {session.visitor_email}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg}</p>
                )}
              </div>
            </button>
          );
        })}
      </ScrollArea>
    </aside>
  );

  // ── Chat panel ────────────────────────────────────────────────────────────
  const ChatPanel = (
    <main className={cn(
      "flex-1 flex flex-col overflow-hidden",
      // Desktop: always shown; Mobile: shown only when a chat is selected
      "md:flex",
      mobileView === "chat" ? "flex w-full" : "hidden md:flex"
    )}>
      {!activeSession ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
          <Headphones className="h-10 w-10 opacity-20" />
          <p className="text-sm">Select a chat to view the conversation</p>
        </div>
      ) : (
        <>
          {/* Panel header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-card shrink-0">
            {/* Back button — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden shrink-0"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none truncate">
                {activeSession.visitor_name ?? "Anonymous Visitor"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {activeSession.visitor_email ?? "No email"}
                {" · "}
                <span className="capitalize">{activeSession.status}</span>
                {" · "}
                {formatRelative(activeSession.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeSession.status === "waiting" && (
                <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleAccept} disabled={accepting}>
                  {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accept"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleClose}
                disabled={closing}
              >
                {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                <span className="hidden sm:inline ml-1">Close</span>
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-3 md:px-4 md:py-4">
            {msgsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">No messages yet</p>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", msg.sender_type === "agent" ? "flex-row-reverse" : "flex-row")}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
                      msg.sender_type === "agent" ? "bg-primary/15" : msg.sender_type === "bot" ? "bg-muted" : "bg-secondary"
                    )}>
                      {msg.sender_type === "bot"
                        ? <Bot className="h-3 w-3 text-muted-foreground" />
                        : msg.sender_type === "agent"
                        ? <Headphones className="h-3 w-3 text-primary" />
                        : <User className="h-3 w-3 text-secondary-foreground" />}
                    </div>
                    <div className={cn("flex flex-col max-w-[78%]", msg.sender_type === "agent" ? "items-end" : "items-start")}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                          {msg.sender_type === "agent"
                            ? "You"
                            : msg.sender_type === "user"
                            ? (activeSession.visitor_name ?? "Visitor")
                            : "Bot"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className={cn(
                        "px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        msg.sender_type === "agent"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : msg.sender_type === "bot"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : "bg-secondary text-secondary-foreground rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Reply input */}
          <div className="px-3 py-2.5 md:px-4 md:py-3 flex gap-2 items-center bg-card shrink-0">
            {activeSession.status === "waiting" ? (
              <p className="flex-1 text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                Accept the chat to start replying
              </p>
            ) : !isMyActiveChat ? (
              <p className="flex-1 text-sm text-muted-foreground flex items-center gap-2">
                <Headphones className="h-4 w-4 shrink-0" />
                This chat is assigned to another agent
              </p>
            ) : (
              <>
                <Input
                  ref={replyRef}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type your reply…"
                  className="flex-1 h-9 text-sm"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          <Headphones className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">Support Dashboard</span>
          {waitingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 shrink-0">
              {waitingCount} waiting
            </Badge>
          )}
          {totalUnread > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 hidden sm:flex">
              {totalUnread} unread
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0">
          <Circle className="h-2 w-2 fill-current text-emerald-500 shrink-0" />
          <span className="hidden sm:inline">Online</span>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSound}
          title={isSoundOn ? "Mute notifications" : "Unmute notifications"}>
          {isSoundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={async () => { await agentLogout(); signOut(); }} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {SessionsList}
        {ChatPanel}
      </div>
    </div>
  );
}
