import { useState, useRef, useEffect } from 'react';
import { sendAgentChat, applyAgentChanges } from './api';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pendingId?: string;
  diffDescription?: string[];
  applied?: boolean;
  discarded?: boolean;
}

export function ChatPanel({
  isOpen,
  onClose,
  onPlanUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPlanUpdated: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Tôi có thể giúp bạn sửa timeline, đổi màu, thêm bớt layer hoặc điều chỉnh theo ý bạn. Hãy nhập yêu cầu bên dưới.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history for backend
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          content: m.text,
        }));

      const res = await sendAgentChat(text, history);

      const botMsg: ChatMessageItem = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        pendingId: res.hasChanges ? res.pendingId : undefined,
        diffDescription: res.hasChanges ? res.diffDescription : undefined,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `Đã xảy ra lỗi: ${(err as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (msgId: string, pendingId: string) => {
    setApplyingId(pendingId);
    try {
      await applyAgentChanges(pendingId);
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, applied: true } : m)),
      );
      onPlanUpdated();
    } catch (err) {
      alert(`Không áp dụng được: ${(err as Error).message}`);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDiscard = (msgId: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, discarded: true } : m)),
    );
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">💬 AI Chỉnh sửa Video</span>
        <button className="chat-close-btn" onClick={onClose} title="Đóng chat">
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            <div className="chat-bubble">
              <div className="chat-text">{m.text}</div>

              {m.diffDescription && m.diffDescription.length > 0 && (
                <div className="diff-card">
                  <div className="diff-header">Thay đổi đề xuất:</div>
                  <ul className="diff-list">
                    {m.diffDescription.map((d, i) => (
                      <li
                        key={i}
                        className={
                          d.startsWith('+')
                            ? 'diff-add'
                            : d.startsWith('-')
                              ? 'diff-remove'
                              : 'diff-update'
                        }
                      >
                        {d}
                      </li>
                    ))}
                  </ul>

                  {m.pendingId && !m.applied && !m.discarded && (
                    <div className="diff-actions">
                      <button
                        className="btn-apply"
                        onClick={() => handleApply(m.id, m.pendingId!)}
                        disabled={applyingId === m.pendingId}
                      >
                        {applyingId === m.pendingId ? 'Đang áp dụng…' : '✓ Áp dụng'}
                      </button>
                      <button
                        className="btn-discard"
                        onClick={() => handleDiscard(m.id)}
                        disabled={applyingId === m.pendingId}
                      >
                        ✕ Bỏ qua
                      </button>
                    </div>
                  )}

                  {m.applied && <div className="diff-status applied">✓ Đã áp dụng vào timeline</div>}
                  {m.discarded && <div className="diff-status discarded">✕ Đã hủy bỏ</div>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-bubble loading">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Ví dụ: Đổi màu layer title sang vàng, thêm thẻ callout ở 0:15…"
          value={input}
          rows={2}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          className="chat-send-btn"
          onClick={() => void handleSend()}
          disabled={!input.trim() || loading}
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
