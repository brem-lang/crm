import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, Minus, Headphones, Loader2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useChatSession } from "@/hooks/useChatSession";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatHandoff } from "@/hooks/useChatHandoff";
import { getBotResponse, getGreeting, BotStep } from "@/components/chat/botEngine";
import { supabase } from "@/integrations/supabase/client";

type QRMap = Map<string, string[]>;
const GREETING_ID = "local-greeting";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-muted rounded-2xl rounded-tl-sm w-fit">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

async function checkAgentsOnline(): Promise<boolean> {
  const { data } = await supabase
    .from("chat_agents")
    .select("id")
    .eq("is_online", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export function ChatWidget() {
  const { roles } = useAuth();
  const userRoles = roles.length > 0 ? (roles as string[]) : [];

  const { sessionId, createSession, updateVisitorInfo, markWaiting, addToQueue } = useChatSession();
  const { messages: dbMessages, loading: msgLoading, insertMessage } = useChatMessages(sessionId);
  const { isWaiting, isActive, isClosed, queuePosition, sessionStatus } = useChatHandoff(sessionId);

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [botStep, setBotStep] = useState<BotStep>({ name: "menu" });
  const [qrMap, setQrMap] = useState<QRMap>(new Map());
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const greeting = getGreeting(userRoles);

  const displayMessages = sessionId
    ? dbMessages
    : [{ id: GREETING_ID, sender_type: "bot" as const, content: greeting.message, created_at: "" }];

  // ── Seed greeting quick replies ───────────────────────────────────────────
  useEffect(() => {
    setQrMap(prev => {
      if (prev.has(GREETING_ID)) return prev;
      return new Map(prev).set(GREETING_ID, greeting.quickReplies ?? []);
    });
  }, [greeting.quickReplies]);

  // ── Restore bot state from persisted session status ───────────────────────
  useEffect(() => {
    if (sessionStatus === "waiting" && botStep.name !== "awaiting_agent") {
      setBotStep({ name: "awaiting_agent" });
    }
    if (sessionStatus === "active" || sessionStatus === "closed") {
      setAgentJoined(true);
    }
  }, [sessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detect agent join via incoming messages ───────────────────────────────
  useEffect(() => {
    if (dbMessages.some(m => m.sender_type === "agent")) {
      setAgentJoined(true);
      // Re-enable input when agent joins
      if (botStep.name === "awaiting_agent") {
        setBotStep({ name: "menu" });
      }
    }
  }, [dbMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── When status flips to active notify the visitor ────────────────────────
  useEffect(() => {
    if (isActive && botStep.name === "awaiting_agent") {
      setBotStep({ name: "menu" });
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, typing]);

  // ── Unread badge management ───────────────────────────────────────────────
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!open && dbMessages.length > 0) {
      const last = dbMessages[dbMessages.length - 1];
      if (last.sender_type !== "user") setUnread(n => n + 1);
    }
  }, [dbMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core send logic ───────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setSending(true);

      try {
        let sid = sessionId;

        // First ever message → create session and persist the greeting
        if (!sid) {
          sid = await createSession();
          await insertMessage(sid, "bot", greeting.message);
        }

        await insertMessage(sid, "user", text);

        const resp = getBotResponse(text, botStep, userRoles);
        setBotStep(resp.nextStep);

        // ── Handoff: user requested a live agent ──────────────────────────
        if (resp.requestAgent) {
          const available = await checkAgentsOnline();

          if (!available) {
            // No agents online → collect visitor info instead
            setTyping(true);
            setTimeout(async () => {
              setTyping(false);
              const msg =
                "Our agents are currently offline. Let me take your details so we can follow up with you.\n\nWhat's your name?";
              await insertMessage(sid!, "bot", msg);
              setBotStep({ name: "collect_name" });
            }, 700);
          } else {
            // Agents available → enter queue
            await markWaiting(sid);
            const position = await addToQueue(sid);
            setTyping(true);
            setTimeout(async () => {
              setTyping(false);
              const queueMsg =
                position === 1
                  ? "You're next in line! An agent will join you shortly."
                  : `You are #${position} in the queue. An agent will be with you soon.`;
              await insertMessage(sid!, "bot", queueMsg);
              setBotStep({ name: "awaiting_agent" });
            }, 700);
          }
          return;
        }

        // ── Visitor info collected (name + email) → save to session ──────
        if (resp.collectedName && resp.collectedEmail) {
          await updateVisitorInfo(sid, resp.collectedName, resp.collectedEmail);
        }

        // ── Normal bot reply ──────────────────────────────────────────────
        setTyping(true);
        setTimeout(async () => {
          setTyping(false);
          const botMsg = await insertMessage(sid!, "bot", resp.message);
          if (resp.quickReplies?.length) {
            setQrMap(prev => new Map(prev).set(botMsg.id, resp.quickReplies!));
          }
          if (!open) setUnread(n => n + 1);
        }, 900);
      } finally {
        setSending(false);
      }
    },
    [
      sessionId, botStep, userRoles, sending, open,
      createSession, insertMessage, markWaiting, addToQueue,
      updateVisitorInfo, greeting.message,
    ]
  );

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleQuickReply(opt: string) {
    setQrMap(new Map()); // clear all chips immediately
    sendMessage(opt);
  }

  // Input is disabled while waiting for an agent (but re-enabled once joined)
  const inputDisabled = sending || (botStep.name === "awaiting_agent" && !agentJoined);

  // ── Derive input placeholder ──────────────────────────────────────────────
  const inputPlaceholder =
    botStep.name === "collect_name" ? "Enter your name…"
    : botStep.name === "collect_email" ? "Enter your email address…"
    : agentJoined ? "Reply to agent…"
    : "Type a message…";

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-xl",
          "bg-primary text-primary-foreground flex items-center justify-center",
          "transition-transform hover:scale-105 active:scale-95"
        )}
        aria-label="Toggle support chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ── Chat window ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-5 z-50",
            "w-[360px] max-w-[calc(100vw-2.5rem)]",
            "h-[540px] max-h-[calc(100vh-7rem)]",
            "bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              {agentJoined ? <Headphones className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none">Support Chat</p>
              <p className="text-[11px] text-primary-foreground/70 mt-0.5 leading-none">
                {agentJoined
                  ? "Live agent connected"
                  : isWaiting
                  ? "Waiting for agent…"
                  : "Help & Guides assistant"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Agent joined banner */}
          {agentJoined && !isWaiting && (
            <div className="shrink-0 px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-center">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                A live agent has joined the conversation
              </span>
            </div>
          )}

          {/* Queue / waiting status banner */}
          {isWaiting && !agentJoined && (
            <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {queuePosition !== null && queuePosition > 1
                    ? `You are #${queuePosition} in queue — an agent will be with you soon`
                    : "You're next — connecting you to an agent…"}
                </span>
              </div>
            </div>
          )}

          {/* Session closed notice */}
          {isClosed && (
            <div className="shrink-0 px-4 py-1.5 bg-muted border-b text-center">
              <span className="text-[11px] text-muted-foreground">
                This chat has been closed
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {msgLoading ? (
              <div className="flex justify-center py-8">
                <TypingDots />
              </div>
            ) : (
              displayMessages.map(msg => {
                const qr = qrMap.get(msg.id) ?? [];
                // Don't show quick reply chips while waiting or after agent joined (except for agent)
                const showQR = qr.length > 0 && !isWaiting && !isClosed;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.sender_type === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        msg.sender_type === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : msg.sender_type === "agent"
                          ? "bg-emerald-500/10 border border-emerald-500/25 text-foreground rounded-tl-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      )}
                    >
                      {msg.sender_type === "agent" && (
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5 uppercase tracking-wide">
                          Agent
                        </p>
                      )}
                      {msg.content}
                    </div>

                    {showQR && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[90%]">
                        {qr.map(opt => (
                          <button
                            key={opt}
                            onClick={() => handleQuickReply(opt)}
                            disabled={sending}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                              "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {typing && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 flex gap-2 items-center p-3 border-t">
            {isClosed ? (
              <p className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                This session has ended
              </p>
            ) : (
              <>
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={inputPlaceholder}
                  className="rounded-full h-9 text-sm"
                  disabled={inputDisabled}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || inputDisabled}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
