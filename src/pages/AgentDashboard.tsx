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
  Headphones,
  Send,
  X,
  LogOut,
  Circle,
  Clock,
  User,
  Bot,
  Loader2,
  Volume2,
  VolumeX,
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
  } catch {
    // AudioContext unavailable (no user gesture yet) — silently skip
  }
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

  const { agentId, isOnline, setOnline, loading: agentLoading } = useChatAgent();
  const { sessions, loading: sessionsLoading, unreadMap, lastMsgMap, markViewed, acceptChat, closeChat } =
    useAgentSessions(agentId, activeId);
  const { messages, loading: msgsLoading, insertMessage } = useChatMessages(activeId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLInputElement>(null);
  const prevWaitingCount = useRef(0);
  const prevMsgCount = useRef(0);
  const soundEnabled = useRef(true); // toggled by user via header button
  const [isSoundOn, setIsSoundOn] = useState(true);

  const toggleSound = useCallback(() => {
    soundEnabled.current = !soundEnabled.current;
    setIsSoundOn(s => !s);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus reply input when session becomes active
  useEffect(() => {
    const active = sessions.find(s => s.id === activeId);
    if (active?.status === "active") {
      replyRef.current?.focus();
    }
  }, [activeId, sessions]);

  // Sound: new waiting chat in queue
  useEffect(() => {
    const waiting = sessions.filter(s => s.status === "waiting").length;
    if (soundEnabled.current && waiting > prevWaitingCount.current) {
      // Two-tone ascending ping for new queue entry
      playBeep(520, 0.12);
      setTimeout(() => playBeep(660, 0.15), 130);
    }
    prevWaitingCount.current = waiting;
  }, [sessions]);

  // Sound: new message in active chat
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const newest = messages[messages.length - 1];
      if (soundEnabled.current && newest?.sender_type === "user") {
        playBeep(440, 0.1, 0.1);
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

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

  function handleSelect(id: string) {
    setActiveId(id);
    markViewed(id);
  }

  async function handleAccept() {
    if (!activeId || !user) return;
    setAccepting(true);
    try {
      await acceptChat(activeId, user.id);
      toast.success("Chat accepted");
      replyRef.current?.focus();
    } catch {
      // error toast handled in hook
    } finally {
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
    } catch {
      // error toast handled in hook
    } finally {
      setClosing(false);
    }
  }

  async function handleSend() {
    const text = reply.trim();
    if (!text || !activeId || !user) return;
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2 mr-auto">
          <Headphones className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Agent Dashboard</span>
          {waitingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
              {waitingCount} waiting
            </Badge>
          )}
          {totalUnread > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              {totalUnread} unread
            </Badge>
          )}
        </div>

        {/* Online / Offline toggle */}
        <button
          onClick={() => setOnline(!isOnline)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
            isOnline
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "bg-muted border-border text-muted-foreground"
          )}
        >
          <Circle
            className={cn(
              "h-2 w-2 fill-current",
              isOnline ? "text-emerald-500" : "text-muted-foreground"
            )}
          />
          {isOnline ? "Online" : "Offline"}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleSound}
          title={isSoundOn ? "Mute notifications" : "Unmute notifications"}
        >
          {isSoundOn ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={signOut}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r flex flex-col bg-card">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Chats
            </p>
            {sessionsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>

          <ScrollArea className="flex-1">
            {!sessionsLoading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Headphones className="h-8 w-8 opacity-20" />
                <p className="text-sm">No active chats</p>
                {!isOnline && (
                  <p className="text-xs text-center px-4 opacity-70">
                    Go online to receive incoming chats
                  </p>
                )}
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
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          session.status === "waiting"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
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

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!activeSession ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
              <Headphones className="h-10 w-10 opacity-20" />
              <p className="text-sm">Select a chat to view the conversation</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-none">
                    {activeSession.visitor_name ?? "Anonymous Visitor"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSession.visitor_email
                      ? activeSession.visitor_email
                      : "No email on file"}
                    {" · "}
                    <span className="capitalize">{activeSession.status}</span>
                    {" · started "}
                    {formatRelative(activeSession.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeSession.status === "waiting" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleAccept}
                      disabled={accepting}
                    >
                      {accepting ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Accept Chat
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={handleClose}
                    disabled={closing}
                  >
                    {closing ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <X className="h-3 w-3 mr-1" />
                    )}
                    Close
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {msgsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3 max-w-2xl mx-auto">
                    {messages.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">
                        No messages yet
                      </p>
                    )}
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          msg.sender_type === "agent" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {/* Avatar icon */}
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
                            msg.sender_type === "agent"
                              ? "bg-primary/15"
                              : msg.sender_type === "bot"
                              ? "bg-muted"
                              : "bg-secondary"
                          )}
                        >
                          {msg.sender_type === "bot" ? (
                            <Bot className="h-3 w-3 text-muted-foreground" />
                          ) : msg.sender_type === "agent" ? (
                            <Headphones className="h-3 w-3 text-primary" />
                          ) : (
                            <User className="h-3 w-3 text-secondary-foreground" />
                          )}
                        </div>

                        <div
                          className={cn(
                            "flex flex-col max-w-[75%]",
                            msg.sender_type === "agent" ? "items-end" : "items-start"
                          )}
                        >
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                              {msg.sender_type === "agent" ? "You" : msg.sender_type}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                              msg.sender_type === "agent"
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : msg.sender_type === "bot"
                                ? "bg-muted text-foreground rounded-tl-sm"
                                : "bg-secondary text-secondary-foreground rounded-tl-sm"
                            )}
                          >
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
              <div className="px-4 py-3 flex gap-2 items-center bg-card shrink-0">
                {activeSession.status === "waiting" ? (
                  <p className="flex-1 text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    Accept the chat above to start replying
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
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
