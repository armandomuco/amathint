import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { askStudentChat, createTeacherDitare } from "../api";
import { Alert } from "../components/Alert";
import type { TranslationCopy } from "../i18n";
import type { ChatMessage } from "../types";
import { chatErrorMessage } from "../utils/errors";
import { isGreetingInput } from "../utils/validation";

export function StudentChat({ copy, token }: { copy: TranslationCopy; token: string }) {
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentQuestion = question.trim();
    if (!currentQuestion) return;
    if (currentQuestion.length < 3 && !isGreetingInput(currentQuestion)) {
      setError(copy.questionTooShort);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await askStudentChat(token, currentQuestion, conversationId);
      setConversationId(response.conversation.id);
      setQuestion("");
      setMessages((current) => [...current, { role: "student", content: currentQuestion }]);
      const answer = response.messages.find((message) => message.role === "assistant");
      if (answer) {
        setMessages((current) => [...current, answer]);
      }
    } catch (err) {
      setError(chatErrorMessage(err, copy.chatbotFailed, copy.chatbotServerProblem));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatShell copy={copy} title={copy.studentChatTitle} subtitle={copy.studentChatSubtitle} tip={copy.studentChatTip}>
      <MessageList messages={messages} emptyText={copy.studentEmpty} />
      {error && <Alert tone="error" message={error} />}
      <form className="composer" onSubmit={submit}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.studentPlaceholder} />
        <button className="primary" disabled={loading}>
          {loading ? copy.sending : copy.send}
        </button>
      </form>
    </ChatShell>
  );
}

export function TeacherAssistant({ copy, token }: { copy: TranslationCopy; token: string }) {
  const [message, setMessage] = useState("Dua te gjeneroj ditare per matematiken klasa 7");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState<"fake" | "anthropic">("fake");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentMessage = message.trim();
    if (!currentMessage) return;
    setMessages((current) => [...current, { role: "teacher", content: currentMessage }]);
    setMessage("");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await createTeacherDitare(token, {
        message: currentMessage,
        provider,
        force: false,
        render: true
      });
      const details = [
        response.assistant,
        response.run.status === "completed" || response.batch ? copy.generatedDocumentsReady : ""
      ]
        .filter(Boolean)
        .join("\n");
      setMessages((current) => [...current, { role: "assistant", content: details }]);
      if (response.run.status === "completed" || response.batch) {
        setSuccess(copy.generatedDocumentsReady);
      }
    } catch (err) {
      setError(chatErrorMessage(err, copy.teacherFailed, copy.teacherServerProblem));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatShell copy={copy} title={copy.teacherChatTitle} subtitle={copy.teacherChatSubtitle} tip={copy.teacherChatTip}>
      <div className="provider-panel">
        <div>
          <p className="mini-label">{copy.providerTitle}</p>
          <p>{copy.providerIntro}</p>
        </div>
        <div className="segmented compact">
          <button type="button" className={provider === "fake" ? "active" : ""} onClick={() => setProvider("fake")}>
            {copy.local}
          </button>
          <button
            type="button"
            className={provider === "anthropic" ? "active" : ""}
            onClick={() => setProvider("anthropic")}
          >
            {copy.anthropic}
          </button>
        </div>
        <div className="provider-help-grid">
          <div className={provider === "fake" ? "active" : ""}>
            <strong>{copy.local}</strong>
            <p>{copy.localProviderHelp}</p>
          </div>
          <div className={provider === "anthropic" ? "active" : ""}>
            <strong>{copy.anthropic}</strong>
            <p>{copy.anthropicProviderHelp}</p>
          </div>
        </div>
      </div>
      <MessageList messages={messages} emptyText={copy.teacherEmpty} />
      {loading && <Alert tone="info" message={copy.generationInProgress} />}
      {success && <Alert tone="success" message={success} />}
      {error && <Alert tone="error" message={error} />}
      <form className="composer" onSubmit={submit}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={copy.teacherPlaceholder} />
        <button className="primary" disabled={loading}>
          {loading ? copy.generating : copy.generate}
        </button>
      </form>
    </ChatShell>
  );
}

function ChatShell({
  copy,
  title,
  subtitle,
  tip,
  children
}: {
  copy: TranslationCopy;
  title: string;
  subtitle: string;
  tip: string;
  children: ReactNode;
}) {
  return (
    <main className="chat-page">
      <section className="page-heading">
        <p className="eyebrow">{copy.amathintChat}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      <section className="chat-layout">
        <aside className="chat-info-card">
          <div className="chat-info-icon">π</div>
          <h2>{copy.chatTipTitle}</h2>
          <p>{tip}</p>
        </aside>
        <section className="chat-surface">{children}</section>
      </section>
    </main>
  );
}

function MessageList({ messages, emptyText }: { messages: ChatMessage[]; emptyText: string }) {
  const visibleMessages = useMemo(() => messages, [messages]);
  return (
    <div className="messages">
      {!visibleMessages.length && <p className="empty">{emptyText}</p>}
      {visibleMessages.map((message, index) => (
        <div className={`message ${message.role === "assistant" ? "assistant" : "user"}`} key={`${message.role}-${index}`}>
          <span>{message.role}</span>
          <p>{message.content}</p>
          {message.provider && <small>{message.provider} · {message.model}</small>}
        </div>
      ))}
    </div>
  );
}
