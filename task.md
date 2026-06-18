## Chat Support System — Development Plan

---

### Phase 1 — UI Only

**Chat Widget (User Side)**

- Floating chat button fixed at bottom right
- Chat window with message bubbles
- Bot messages on left, user messages on right
- Quick reply buttons for menu options
- "Talk to Agent" button
- Typing indicator
- Input box + send button
- Agent joined notification banner

**Agent Login Page**

- Separate login page at `/agent/login`
- Email and password fields
- Role check on submit (agent only)

**Agent Dashboard**

- Online / Offline toggle at the top
- Left sidebar with list of waiting and active chats
- Right panel with full chat conversation
- Reply input box + send button
- Close chat button
- Unread message badge on chat list

---

### Phase 2 — Database & Realtime

- Create tables for chat sessions, messages, agents, and queue
- Enable Supabase Realtime on chat tables
- Messages appear instantly without polling
- Agent online status syncs in real time
- Queue position updates live

---

### Phase 3 — Bot Logic

- Rule-based bot using decision tree
- Greeting message on chat open
- Menu options as quick reply buttons
- Pre-written answers for each option
- Fallback message if no match
- "Talk to Agent" trigger
- Bot collects name and email if no agent available

---

### Phase 4 — Agent System

- Agent login with role check
- Toggle Online / Offline status
- Incoming chat request notification
- Accept or reject a chat
- Multiple chats handled at once
- Full bot conversation history visible to agent
- Close chat when resolved

---

### Phase 5 — Handoff Flow

- User requests live agent
- System checks agent availability
- If online → agent gets notified → accepts → live chat begins
- If offline → bot collects info → saves for follow up
- Queue system if all agents are busy
- User sees queue position
- User notified when agent joins

---

### Phase 6 — Polish & Production

- Mobile responsive chat widget
- Sound notification for new messages
- Chat transcript saved after session closes
- Agent can see chat history of returning users
- Admin can view all chat sessions
- Basic analytics (total chats, avg response time, resolution rate)

---

create plan check the codes
