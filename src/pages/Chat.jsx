import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  PackageCheck,
} from "lucide-react";
import { supabase } from "../services/supabase";

export default function Chat() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("request");

  const [currentUser, setCurrentUser] = useState(null);
  const [request, setRequest] = useState(null);

  const [lostItem, setLostItem] = useState(null);
  const [foundItem, setFoundItem] = useState(null);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const messagesEndRef = useRef(null);
  const chatChannelRef = useRef(null);

  /* ---------------------------------------------------------
     CHAT INITIALIZATION
  --------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    if (!requestId) {
      setError("No contact request was provided.");
      setLoading(false);
      return;
    }

    const startChat = async () => {
      if (cancelled) return;

      await initializeChat();

      if (cancelled && chatChannelRef.current) {
        await supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };

    startChat();

    return () => {
      cancelled = true;

      // IMPORTANT:
      // Remove only this component's channel.
      // Do NOT use removeAllChannels().
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [requestId]);

  /* ---------------------------------------------------------
     SCROLL TO BOTTOM
  --------------------------------------------------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /* ---------------------------------------------------------
     PERIODIC ITEM STATUS CHECK
  --------------------------------------------------------- */

  useEffect(() => {
    if (!request) return;

    const interval = setInterval(() => {
      loadItemStatus(request);
    }, 3000);

    return () => clearInterval(interval);
  }, [request]);

  /* ---------------------------------------------------------
     CLOSE REALTIME WHEN CASE IS CLOSED
  --------------------------------------------------------- */

  useEffect(() => {
    const caseClosed =
      lostItem?.status === "returned" &&
      foundItem?.status === "returned";

    if (caseClosed && chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;

      console.log(
        "Realtime channel closed because the case is closed."
      );
    }
  }, [lostItem?.status, foundItem?.status]);

  /* ---------------------------------------------------------
     INITIALIZE CHAT
  --------------------------------------------------------- */

  async function initializeChat() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError("You must be logged in to use private chat.");
        setLoading(false);
        return;
      }

      const user = session.user;
      setCurrentUser(user);

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("contact_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) {
        throw requestError;
      }

      if (!requestData) {
        throw new Error("Contact request not found.");
      }

      const isParticipant =
        requestData.requester_id === user.id ||
        requestData.receiver_id === user.id;

      if (!isParticipant) {
        throw new Error(
          "You are not a participant in this private conversation."
        );
      }

      if (requestData.status !== "accepted") {
        throw new Error(
          "This private chat is available only after the request is accepted."
        );
      }

      setRequest(requestData);

      const itemStatus = await loadItemStatus(requestData);

      await loadMessages(requestData.id);

      const caseAlreadyClosed =
        itemStatus?.lost?.status === "returned" &&
        itemStatus?.found?.status === "returned";

      if (!caseAlreadyClosed) {
        subscribeToMessages(requestData.id);
      }
    } catch (err) {
      console.error("Chat initialization error:", err);
      setError(err.message || "Unable to open chat.");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------
     LOAD ITEMS
  --------------------------------------------------------- */

  async function loadItemStatus(contactRequest) {
    if (!contactRequest) return null;

    try {
      const {
        data: lost,
        error: lostError,
      } = await supabase
        .from("lost_items")
        .select("*")
        .eq("id", contactRequest.lost_item_id)
        .single();

      if (lostError) {
        console.error("Lost item error:", lostError);
      } else {
        setLostItem(lost);
      }

      const {
        data: found,
        error: foundError,
      } = await supabase
        .from("found_items")
        .select("*")
        .eq("id", contactRequest.found_item_id)
        .single();

      if (foundError) {
        console.error("Found item error:", foundError);
      } else {
        setFoundItem(found);
      }

      return {
        lost,
        found,
      };
    } catch (err) {
      console.error("Unable to load item status:", err);

      return {
        lost: null,
        found: null,
      };
    }
  }

  /* ---------------------------------------------------------
     LOAD MESSAGES
  --------------------------------------------------------- */

  async function loadMessages(contactRequestId) {
    const {
      data,
      error: messageError,
    } = await supabase
      .from("messages")
      .select("*")
      .eq("contact_request_id", contactRequestId)
      .order("created_at", {
        ascending: true,
      });

    if (messageError) {
      throw messageError;
    }

    setMessages(data || []);
  }

  /* ---------------------------------------------------------
     REALTIME SUBSCRIPTION
     
     THIS IS THE IMPORTANT FIX.
  --------------------------------------------------------- */

  function subscribeToMessages(contactRequestId) {
    // Remove an old channel belonging to this component.
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }

    const channelName = `private-chat-${contactRequestId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `contact_request_id=eq.${contactRequestId}`,
        },
        async (payload) => {
          console.log(
            "New chat message received:",
            payload.new
          );

          try {
            await loadMessages(contactRequestId);
          } catch (err) {
            console.error(
              "Realtime message refresh error:",
              err
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(
          "Chat realtime status:",
          status
        );
      });

    chatChannelRef.current = channel;

    return channel;
  }

  /* ---------------------------------------------------------
     SEND NORMAL MESSAGE
  --------------------------------------------------------- */

  async function sendMessage(e) {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) return;

    if (!currentUser || !request) {
      setError("Chat is not ready.");
      return;
    }

    if (request.status !== "accepted") {
      setError(
        "This contact request has not been accepted."
      );
      return;
    }

    const caseClosed =
      lostItem?.status === "returned" &&
      foundItem?.status === "returned";

    if (caseClosed) {
      setError(
        "This case is closed because both users confirmed the item was returned."
      );
      return;
    }

    const receiverId =
      request.requester_id === currentUser.id
        ? request.receiver_id
        : request.requester_id;

    if (!receiverId) {
      setError("Unable to identify the other user.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const {
        data,
        error: sendError,
      } = await supabase
        .from("messages")
        .insert([
          {
            contact_request_id: request.id,
            sender_id: currentUser.id,
            receiver_id: receiverId,
            message: trimmedMessage,
          },
        ])
        .select()
        .single();

      if (sendError) {
        throw sendError;
      }

      setMessages((previous) => {
        const exists = previous.some(
          (item) => item.id === data.id
        );

        if (exists) {
          return previous;
        }

        return [...previous, data];
      });

      setMessage("");
    } catch (err) {
      console.error("Send message error:", err);

      setError(
        err.message || "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  }

  /* ---------------------------------------------------------
     SEND SYSTEM MESSAGE
  --------------------------------------------------------- */

  async function sendSystemMessage(text) {
    if (!currentUser || !request) return;

    const receiverId =
      request.requester_id === currentUser.id
        ? request.receiver_id
        : request.requester_id;

    if (!receiverId) return;

    const {
      data,
      error: systemError,
    } = await supabase
      .from("messages")
      .insert([
        {
          contact_request_id: request.id,
          sender_id: currentUser.id,
          receiver_id: receiverId,
          message: `[SYSTEM] ${text}`,
        },
      ])
      .select()
      .single();

    if (systemError) {
      console.error(
        "System message error:",
        systemError
      );
      return;
    }

    setMessages((previous) => {
      const exists = previous.some(
        (item) => item.id === data.id
      );

      if (exists) return previous;

      return [...previous, data];
    });
  }

  /* ---------------------------------------------------------
     CONFIRM ITEM RETURN
  --------------------------------------------------------- */

  async function confirmItemStatus() {
    if (
      !currentUser ||
      !request ||
      !lostItem ||
      !foundItem
    ) {
      return;
    }

    setUpdatingStatus(true);
    setError("");
    setSuccess("");

    try {
      const isLostOwner =
        currentUser.id === lostItem.user_id;

      const isFoundOwner =
        currentUser.id === foundItem.user_id;

      if (!isLostOwner && !isFoundOwner) {
        throw new Error(
          "You are not the owner of either item in this case."
        );
      }

      /* -----------------------------------------------
         LOST OWNER
         "I Received My Item"
      ------------------------------------------------ */

      if (
        isLostOwner &&
        lostItem.status !== "returned"
      ) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("lost_items")
          .update({
            status: "returned",
            returned_at: new Date().toISOString(),
          })
          .eq("id", lostItem.id)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setLostItem(data);

        await sendSystemMessage(
          "The lost-item owner confirmed: I received my item."
        );

        setSuccess(
          "You confirmed that you received your item."
        );
      }

      /* -----------------------------------------------
         FOUND OWNER
         "I Returned The Item"
      ------------------------------------------------ */

      if (
        isFoundOwner &&
        foundItem.status !== "returned"
      ) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("found_items")
          .update({
            status: "returned",
            returned_at: new Date().toISOString(),
          })
          .eq("id", foundItem.id)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setFoundItem(data);

        await sendSystemMessage(
          "The finder confirmed: I returned the item."
        );

        setSuccess(
          "You confirmed that you returned the item."
        );
      }

      /* -----------------------------------------------
         REFRESH BOTH ITEMS
      ------------------------------------------------ */

      const updated = await loadItemStatus(request);

      const nowClosed =
        updated?.lost?.status === "returned" &&
        updated?.found?.status === "returned";

      if (nowClosed) {
        if (chatChannelRef.current) {
          await supabase.removeChannel(
            chatChannelRef.current
          );

          chatChannelRef.current = null;
        }

        setSuccess(
          "Both users confirmed the return. This case is now closed."
        );
      }
    } catch (err) {
      console.error(
        "Confirm item status error:",
        err
      );

      setError(
        err.message ||
          "Unable to update item status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  /* ---------------------------------------------------------
     DATE FORMAT
  --------------------------------------------------------- */

  function formatTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function formatDate(value) {
    if (!value) return "";

    return new Date(value).toLocaleDateString(
      [],
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  /* ---------------------------------------------------------
     MESSAGE TYPE
  --------------------------------------------------------- */

  function isSystemMessage(text) {
    return text?.startsWith("[SYSTEM]");
  }

  /* ---------------------------------------------------------
     RETURN STATUS
  --------------------------------------------------------- */

  const lostReturned =
    lostItem?.status === "returned";

  const foundReturned =
    foundItem?.status === "returned";

  const caseClosed =
    lostReturned && foundReturned;

  const isLostOwner =
    currentUser &&
    lostItem &&
    currentUser.id === lostItem.user_id;

  const isFoundOwner =
    currentUser &&
    foundItem &&
    currentUser.id === foundItem.user_id;

  /* ---------------------------------------------------------
     LOADING
  --------------------------------------------------------- */

  if (loading) {
    return (
      <>
        <style>{styles}</style>

        <div className="chat-loading">
          <div className="loading-spinner" />

          <p>
            Opening private conversation...
          </p>
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------
     ERROR
  --------------------------------------------------------- */

  if (error && !request) {
    return (
      <>
        <style>{styles}</style>

        <div className="chat-error-card">
          <XCircle size={45} />

          <h2>Unable to Open Chat</h2>

          <p>{error}</p>

          <Link
            to="/dashboard"
            className="back-button"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <main className="chat-page">

        {/* -------------------------------------------------
            TOP BAR
        ------------------------------------------------- */}

        <div className="chat-topbar">

          <Link
            to="/dashboard"
            className="back-link"
          >
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <div className="chat-title-area">
            <div className="eyebrow">
              PRIVATE CONTACT CHANNEL
            </div>

            <h1>
              Lost & Found Chat
            </h1>

            <p>
              Communicate privately about the
              matched item.
            </p>
          </div>

          <div
            className={
              caseClosed
                ? "closed-badge"
                : "accepted-badge"
            }
          >
            {caseClosed ? (
              <>
                <CheckCircle size={14} />
                CASE CLOSED
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                PRIVATE
              </>
            )}
          </div>
        </div>

        {/* -------------------------------------------------
            ERROR / SUCCESS
        ------------------------------------------------- */}

        {error && (
          <div className="alert error-alert">
            <XCircle size={17} />
            <span>{error}</span>

            <button
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="alert success-alert">
            <CheckCircle size={17} />
            <span>{success}</span>

            <button
              onClick={() => setSuccess("")}
            >
              ×
            </button>
          </div>
        )}

        {/* -------------------------------------------------
            ITEM INFORMATION
        ------------------------------------------------- */}

        <section className="case-card">

          <div className="case-header">

            <div>
              <div className="request-label">
                CONTACT REQUEST
              </div>

              <div className="request-id">
                {request?.id}
              </div>
            </div>

            <div
              className={
                caseClosed
                  ? "chat-status closed-chat-status"
                  : "chat-status"
              }
            >
              {caseClosed ? (
                <>
                  <CheckCircle size={13} />
                  Closed
                </>
              ) : (
                <>
                  <CheckCircle size={13} />
                  Accepted
                </>
              )}
            </div>
          </div>

          <div className="case-items">

            {/* LOST ITEM */}

            <div className="item-card">

              <div className="item-label">
                LOST ITEM
              </div>

              {lostItem?.image_url && (
                <img
                  src={lostItem.image_url}
                  alt={lostItem.item_name}
                  className="item-image"
                />
              )}

              <h3>
                {lostItem?.item_name ||
                  "Lost Item"}
              </h3>

              <p>
                {lostItem?.description ||
                  "No description available."}
              </p>

              <div className="item-meta">
                <span>
                  📍 {lostItem?.location ||
                    "Unknown location"}
                </span>

                <span>
                  📅 {lostItem?.lost_date ||
                    "Unknown date"}
                </span>
              </div>

            </div>

            {/* MATCH */}

            <div className="match-icon">
              <MessageCircle size={23} />
            </div>

            {/* FOUND ITEM */}

            <div className="item-card">

              <div className="item-label">
                FOUND ITEM
              </div>

              {foundItem?.image_url && (
                <img
                  src={foundItem.image_url}
                  alt={foundItem.item_name}
                  className="item-image"
                />
              )}

              <h3>
                {foundItem?.item_name ||
                  "Found Item"}
              </h3>

              <p>
                {foundItem?.description ||
                  "No description available."}
              </p>

              <div className="item-meta">
                <span>
                  📍 {foundItem?.location ||
                    "Unknown location"}
                </span>

                <span>
                  📅 {foundItem?.found_date ||
                    "Unknown date"}
                </span>
              </div>

            </div>

          </div>

        </section>

        {/* -------------------------------------------------
            RETURN STATUS
        ------------------------------------------------- */}

        <section className="return-status">

          <div className="return-heading">

            <div className="return-icon">
              <PackageCheck size={19} />
            </div>

            <div>
              <h2>
                Item Recovery Status
              </h2>

              <p>
                Both sides must confirm the
                return before this case closes.
              </p>
            </div>

          </div>

          <div className="status-grid">

            {/* LOST OWNER */}

            <div
              className={
                lostReturned
                  ? "person-status completed"
                  : "person-status"
              }
            >
              <div className="status-person-icon">
                {lostReturned ? (
                  <CheckCircle size={17} />
                ) : (
                  <Clock size={17} />
                )}
              </div>

              <div className="status-person-content">

                <strong>
                  Lost-item owner
                </strong>

                <span>
                  {lostReturned
                    ? "Confirmed item received"
                    : "Waiting for confirmation"}
                </span>

                {lostItem?.returned_at && (
                  <small>
                    {formatDate(
                      lostItem.returned_at
                    )}
                  </small>
                )}

              </div>
            </div>

            {/* FOUND OWNER */}

            <div
              className={
                foundReturned
                  ? "person-status completed"
                  : "person-status"
              }
            >
              <div className="status-person-icon">
                {foundReturned ? (
                  <CheckCircle size={17} />
                ) : (
                  <Clock size={17} />
                )}
              </div>

              <div className="status-person-content">

                <strong>
                  Finder
                </strong>

                <span>
                  {foundReturned
                    ? "Confirmed item returned"
                    : "Waiting for confirmation"}
                </span>

                {foundItem?.returned_at && (
                  <small>
                    {formatDate(
                      foundItem.returned_at
                    )}
                  </small>
                )}

              </div>
            </div>

          </div>

          {/* LOST OWNER BUTTON */}

          {isLostOwner && !lostReturned && (
            <button
              className="return-button"
              onClick={confirmItemStatus}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <span className="send-spinner" />
              ) : (
                <CheckCircle size={16} />
              )}

              I Received My Item
            </button>
          )}

          {/* FOUND OWNER BUTTON */}

          {isFoundOwner && !foundReturned && (
            <button
              className="return-button"
              onClick={confirmItemStatus}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <span className="send-spinner" />
              ) : (
                <PackageCheck size={16} />
              )}

              I Returned The Item
            </button>
          )}

          {/* CURRENT USER ALREADY CONFIRMED */}

          {((isLostOwner && lostReturned) ||
            (isFoundOwner && foundReturned)) &&
            !caseClosed && (
              <div className="already-confirmed">
                <CheckCircle size={16} />

                <strong>
                  Your confirmation is recorded.
                </strong>

                <span>
                  Waiting for the other person
                  to confirm.
                </span>
              </div>
            )}

          {/* CASE CLOSED */}

          {caseClosed && (
            <div className="case-closed-message">

              <CheckCircle size={19} />

              <div>
                <strong>
                  Item successfully returned
                </strong>

                <span>
                  Both users confirmed the return.
                  This Lost & Found case is now closed.
                </span>
              </div>

            </div>
          )}

        </section>

        {/* -------------------------------------------------
            CHAT
        ------------------------------------------------- */}

        <section className="chat-box">

          <header className="chat-header">

            <div>
              <div className="request-label">
                PRIVATE CHAT
              </div>

              <div className="request-id">
                {request?.id}
              </div>
            </div>

            <div
              className={
                caseClosed
                  ? "chat-status closed-chat-status"
                  : "chat-status"
              }
            >
              {caseClosed ? (
                <>
                  <CheckCircle size={13} />
                  Closed
                </>
              ) : (
                <>
                  <ShieldCheck size={13} />
                  Private
                </>
              )}
            </div>

          </header>

          {/* MESSAGES */}

          <div className="messages-area">

            {messages.length === 0 ? (
              <div className="empty-chat">

                <div className="empty-chat-icon">
                  <MessageCircle size={27} />
                </div>

                <h3>
                  Private conversation
                </h3>

                <p>
                  This is a private communication
                  channel between the person who
                  lost the item and the person who
                  found it.
                </p>

              </div>
            ) : (
              <div className="messages-list">

                {messages.map((item) => {

                  const system =
                    isSystemMessage(
                      item.message
                    );

                  if (system) {
                    return (
                      <div
                        key={item.id}
                        className="system-message"
                      >
                        <CheckCircle size={14} />

                        <span>
                          {item.message.replace(
                            "[SYSTEM]",
                            ""
                          ).trim()}
                        </span>

                        <small>
                          {formatTime(
                            item.created_at
                          )}
                        </small>
                      </div>
                    );
                  }

                  const mine =
                    item.sender_id ===
                    currentUser?.id;

                  return (
                    <div
                      key={item.id}
                      className={
                        mine
                          ? "message-row mine"
                          : "message-row theirs"
                      }
                    >
                      <div
                        className={
                          mine
                            ? "message-bubble mine"
                            : "message-bubble theirs"
                        }
                      >

                        <div className="message-text">
                          {item.message}
                        </div>

                        <div className="message-time">
                          {formatTime(
                            item.created_at
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />

              </div>
            )}

          </div>

          {/* -------------------------------------------------
              INPUT
          ------------------------------------------------- */}

          {!caseClosed ? (
            <form
              className="message-form"
              onSubmit={sendMessage}
            >

              <div className="input-wrapper">

                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  placeholder="Type a private message..."
                  maxLength={1000}
                  disabled={sending}
                />

                <span className="character-count">
                  {message.length}/1000
                </span>

              </div>

              <button
                type="submit"
                className="send-chat-button"
                disabled={
                  sending ||
                  !message.trim()
                }
              >
                {sending ? (
                  <span className="send-spinner" />
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>

            </form>
          ) : (
            <div className="closed-chat-footer">

              <CheckCircle size={16} />

              This private conversation is closed
              because both users confirmed the item
              was returned.

            </div>
          )}

        </section>

        {/* -------------------------------------------------
            FOOTER
        ------------------------------------------------- */}

        <div className="chat-footer">

          <ShieldCheck size={13} />

          <span>
            Private communication channel
          </span>

          <span className="dot">•</span>

          <span>
            Only the two participants can access
            this conversation
          </span>

        </div>

      </main>
    </>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = `

* {
  box-sizing: border-box;
}

.chat-page {
  min-height: 100vh;
  padding: 25px 20px 50px;
  background:
    radial-gradient(
      circle at 10% 0%,
      rgba(139, 77, 50, 0.07),
      transparent 30%
    ),
    radial-gradient(
      circle at 90% 10%,
      rgba(78, 91, 61, 0.06),
      transparent 28%
    ),
    #f6f1e8;

  color: #302c26;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.chat-topbar {
  width: min(1150px, 100%);
  margin: 0 auto 20px;

  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: #6e6255;
  text-decoration: none;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 11px;

  transition: 0.2s ease;
}

.back-link:hover {
  color: #8b4d32;
}

.chat-title-area {
  text-align: center;
}

.eyebrow {
  color: #8b4d32;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 9px;
  letter-spacing: 1.7px;
  margin-bottom: 5px;
}

.chat-title-area h1 {
  margin: 0;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  font-size: 29px;
  color: #302c26;
}

.chat-title-area p {
  margin: 5px 0 0;

  color: #81776a;
  font-size: 12px;
}

.accepted-badge,
.closed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  padding: 8px 12px;

  border-radius: 50px;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 9px;
}

.accepted-badge {
  color: #4e5b3d;
  background: rgba(78, 91, 61, 0.09);
}

.closed-badge {
  color: #8b4d32;
  background: rgba(139, 77, 50, 0.09);
}

/* ALERTS */

.alert {
  width: min(1150px, 100%);
  margin: 0 auto 12px;

  display: flex;
  align-items: center;
  gap: 9px;

  padding: 12px 14px;

  border-radius: 10px;

  font-size: 12px;
}

.alert span {
  flex: 1;
}

.alert button {
  border: 0;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
}

.error-alert {
  color: #8b4d32;
  background: rgba(139, 77, 50, 0.08);
  border: 1px solid rgba(139, 77, 50, 0.15);
}

.success-alert {
  color: #4e5b3d;
  background: rgba(78, 91, 61, 0.08);
  border: 1px solid rgba(78, 91, 61, 0.15);
}

/* CASE CARD */

.case-card {
  width: min(1150px, 100%);
  margin: 0 auto 15px;

  background: #fffdf8;

  border: 1px solid rgba(91, 76, 58, 0.14);

  border-radius: 17px;

  overflow: hidden;

  box-shadow:
    0 15px 40px rgba(52, 43, 32, 0.06);
}

.case-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 14px 18px;

  border-bottom:
    1px solid rgba(91, 76, 58, 0.12);

  background:
    rgba(250, 246, 237, 0.75);
}

.request-label {
  color: #8b4d32;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 9px;
  letter-spacing: 1px;
}

.request-id {
  margin-top: 4px;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 10px;

  color: #71685b;

  word-break: break-all;
}

.chat-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  padding: 6px 10px;

  border-radius: 50px;

  background: #eee9dc;
  color: #4e5b3d;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 9px;
}

.closed-chat-status {
  background: rgba(139, 77, 50, 0.09);
  color: #8b4d32;
}

.case-items {
  display: grid;

  grid-template-columns:
    1fr
    50px
    1fr;

  align-items: center;

  gap: 15px;

  padding: 18px;
}

.item-card {
  min-width: 0;

  padding: 16px;

  border-radius: 13px;

  background: #faf6ed;

  border:
    1px solid rgba(91, 76, 58, 0.11);
}

.item-label {
  margin-bottom: 10px;

  color: #8b4d32;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;

  letter-spacing: 1px;
}

.item-image {
  width: 75px;
  height: 75px;

  object-fit: cover;

  border-radius: 9px;

  margin-bottom: 9px;
}

.item-card h3 {
  margin: 0 0 5px;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  font-size: 18px;
}

.item-card p {
  margin: 0 0 10px;

  color: #756c60;

  font-size: 11px;
  line-height: 1.5;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;

  color: #82796d;

  font-size: 9px;

  font-family:
    "IBM Plex Mono",
    monospace;
}

.match-icon {
  width: 42px;
  height: 42px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  background: rgba(139, 77, 50, 0.09);
  color: #8b4d32;
}

/* RETURN STATUS */

.return-status {
  width: min(1150px, 100%);
  margin: 0 auto 15px;

  padding: 17px;

  background: #fffdf8;

  border:
    1px solid rgba(91, 76, 58, 0.14);

  border-radius: 17px;

  box-shadow:
    0 15px 40px rgba(52, 43, 32, 0.05);
}

.return-heading {
  display: flex;
  align-items: center;
  gap: 10px;

  margin-bottom: 15px;
}

.return-icon {
  width: 38px;
  height: 38px;

  display: grid;
  place-items: center;

  border-radius: 10px;

  background: rgba(78, 91, 61, 0.1);
  color: #4e5b3d;
}

.return-heading h2 {
  margin: 0;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  font-size: 18px;
}

.return-heading p {
  margin: 3px 0 0;

  color: #81776a;

  font-size: 11px;
}

.status-grid {
  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 10px;
}

.person-status {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 11px;

  border-radius: 10px;

  background: #f8f3e9;

  border:
    1px solid rgba(91, 76, 58, 0.1);
}

.person-status.completed {
  background: rgba(78, 91, 61, 0.07);

  border-color:
    rgba(78, 91, 61, 0.17);
}

.status-person-icon {
  width: 32px;
  height: 32px;

  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;

  background: #e8dfcf;

  color: #806c42;
}

.person-status.completed
.status-person-icon {
  background: rgba(78, 91, 61, 0.13);
  color: #4e5b3d;
}

.status-person-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-person-content strong {
  font-size: 11px;
}

.status-person-content span {
  color: #71685b;
  font-size: 10px;
}

.status-person-content small {
  color: #93897a;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;
}

.return-button {
  width: 100%;

  margin-top: 12px;

  min-height: 43px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 7px;

  border: 0;
  border-radius: 10px;

  background: #4e5b3d;

  color: white;

  cursor: pointer;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 10px;

  transition: 0.2s ease;
}

.return-button:hover:not(:disabled) {
  background: #3e4930;
  transform: translateY(-1px);
}

.return-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.already-confirmed {
  margin-top: 12px;

  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;

  padding: 11px;

  border-radius: 10px;

  background: rgba(78, 91, 61, 0.08);

  color: #4e5b3d;

  font-size: 11px;
}

.already-confirmed span {
  width: 100%;
  margin-left: 23px;

  color: #777060;
}

.case-closed-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;

  margin-top: 12px;

  padding: 12px;

  border-radius: 10px;

  background: rgba(78, 91, 61, 0.1);

  color: #4e5b3d;
}

.case-closed-message strong {
  display: block;

  font-size: 12px;

  margin-bottom: 3px;
}

.case-closed-message span {
  display: block;

  color: #68705a;

  font-size: 10px;

  line-height: 1.5;
}

/* CHAT */

.chat-box {
  width: min(1150px, 100%);
  margin: 0 auto;

  height: min(680px, 75vh);

  min-height: 500px;

  display: flex;
  flex-direction: column;

  background: #fffdf8;

  border:
    1px solid rgba(91, 76, 58, 0.15);

  border-radius: 18px;

  overflow: hidden;

  box-shadow:
    0 18px 45px rgba(52, 43, 32, 0.08);
}

.chat-header {
  display: flex;

  justify-content: space-between;
  align-items: center;

  padding: 15px 20px;

  border-bottom:
    1px solid rgba(91, 76, 58, 0.13);

  background:
    rgba(250, 246, 237, 0.8);
}

.messages-area {
  flex: 1;

  overflow-y: auto;

  padding: 25px 20px;

  background:
    radial-gradient(
      circle at 20% 20%,
      rgba(139, 77, 50, 0.025),
      transparent 30%
    ),
    #fffdf8;
}

.messages-list {
  display: flex;
  flex-direction: column;

  gap: 10px;
}

.message-row {
  display: flex;
  width: 100%;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-row.theirs {
  justify-content: flex-start;
}

.message-bubble {
  max-width: min(70%, 550px);

  padding: 11px 13px 8px;

  border-radius: 13px;
}

.message-bubble.mine {
  background: #8b4d32;
  color: white;

  border-bottom-right-radius: 4px;
}

.message-bubble.theirs {
  background: #eee6d8;
  color: #38332b;

  border-bottom-left-radius: 4px;
}

.message-text {
  font-size: 13px;
  line-height: 1.55;

  white-space: pre-wrap;

  overflow-wrap: anywhere;
}

.message-time {
  display: flex;

  justify-content: flex-end;

  margin-top: 5px;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;

  opacity: 0.65;
}

.system-message {
  width: min(650px, 90%);

  margin: 8px auto;

  padding: 10px 13px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 7px;

  flex-wrap: wrap;

  border-radius: 10px;

  background: rgba(78, 91, 61, 0.07);

  border:
    1px solid rgba(78, 91, 61, 0.14);

  color: #4e5b3d;

  font-size: 10px;

  text-align: center;
}

.system-message small {
  color: #8b907e;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;
}

.empty-chat {
  height: 100%;

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  text-align: center;

  padding: 20px;

  color: #71685b;
}

.empty-chat-icon {
  width: 65px;
  height: 65px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  background: #eee6d8;

  color: #8b4d32;

  margin-bottom: 15px;
}

.empty-chat h3 {
  margin: 0 0 7px;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  font-size: 23px;

  color: #3d382f;
}

.empty-chat p {
  max-width: 420px;

  margin: 0;

  font-size: 12px;

  line-height: 1.6;
}

/* MESSAGE FORM */

.message-form {
  display: grid;

  grid-template-columns: 1fr auto;

  gap: 10px;

  padding: 15px;

  border-top:
    1px solid rgba(91, 76, 58, 0.13);

  background: #fffdf8;
}

.input-wrapper {
  position: relative;
}

.input-wrapper textarea {
  width: 100%;

  min-height: 68px;

  max-height: 160px;

  resize: vertical;

  border:
    1px solid rgba(91, 76, 58, 0.2);

  border-radius: 11px;

  background: #f8f3e9;

  color: #29261f;

  padding:
    13px 15px 25px;

  outline: none;

  font: inherit;

  font-size: 13px;
}

.input-wrapper textarea:focus {
  border-color: #8b4d32;

  box-shadow:
    0 0 0 3px rgba(139, 77, 50, 0.08);
}

.input-wrapper textarea:disabled {
  opacity: 0.65;
}

.character-count {
  position: absolute;

  right: 10px;
  bottom: 7px;

  color: #93897a;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;
}

.send-chat-button {
  min-width: 95px;

  border: 0;

  border-radius: 11px;

  background: #8b4d32;

  color: white;

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 7px;

  cursor: pointer;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 10px;

  transition: 0.2s ease;
}

.send-chat-button:hover:not(:disabled) {
  background: #713c27;
  transform: translateY(-1px);
}

.send-chat-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.closed-chat-footer {
  min-height: 70px;

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 9px;

  padding: 15px 20px;

  border-top:
    1px solid rgba(78, 91, 61, 0.15);

  background:
    rgba(78, 91, 61, 0.06);

  color: #4e5b3d;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 9px;

  text-align: center;
}

/* SPINNERS */

.send-spinner,
.loading-spinner {
  width: 17px;
  height: 17px;

  border: 2px solid rgba(255,255,255,0.35);

  border-top-color: white;

  border-radius: 50%;

  animation:
    chatSpin 0.8s linear infinite;
}

@keyframes chatSpin {
  to {
    transform: rotate(360deg);
  }
}

.chat-loading {
  min-height: 80vh;

  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  gap: 12px;

  background: #f6f1e8;

  color: #71685b;

  font-size: 14px;
}

.chat-loading .loading-spinner {
  width: 30px;
  height: 30px;

  border-color:
    rgba(139,77,50,0.2);

  border-top-color: #8b4d32;
}

/* ERROR CARD */

.chat-error-card {
  width: min(550px, calc(100% - 30px));

  margin: 100px auto;

  padding: 35px;

  text-align: center;

  box-sizing: border-box;

  background: #fffdf8;

  border:
    1px solid rgba(91,76,58,0.15);

  border-radius: 18px;

  color: #8b4d32;

  box-shadow:
    0 18px 45px rgba(52,43,32,0.08);
}

.chat-error-card h2 {
  margin: 15px 0 8px;

  font-family:
    Georgia,
    "Times New Roman",
    serif;

  color: #302c26;
}

.chat-error-card p {
  color: #71685b;

  line-height: 1.6;

  font-size: 14px;

  margin-bottom: 25px;
}

.back-button {
  display: inline-flex;

  align-items: center;

  gap: 8px;

  padding: 12px 17px;

  border-radius: 10px;

  background: #8b4d32;

  color: white;

  text-decoration: none;

  font-size: 13px;
}

/* FOOTER */

.chat-footer {
  width: min(1150px, 100%);

  margin: 12px auto 0;

  display: flex;

  align-items: center;

  justify-content: center;

  flex-wrap: wrap;

  gap: 7px;

  color: #83796b;

  font-family:
    "IBM Plex Mono",
    monospace;

  font-size: 8px;

  text-align: center;
}

.chat-footer svg {
  color: #4e5b3d;
}

.dot {
  opacity: 0.5;
}

/* MOBILE */

@media (max-width: 700px) {

  .chat-page {
    padding:
      15px
      10px
      40px;
  }

  .chat-topbar {
    grid-template-columns:
      auto
      1fr;

    gap: 10px;
  }

  .accepted-badge,
  .closed-badge {
    display: none;
  }

  .chat-title-area {
    text-align: left;
  }

  .chat-title-area h1 {
    font-size: 21px;
  }

  .case-items {
    grid-template-columns: 1fr;
  }

  .match-icon {
    margin: auto;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .chat-box {
    height:
      calc(100vh - 180px);

    min-height: 450px;
  }

  .message-bubble {
    max-width: 82%;
  }

  .message-form {
    grid-template-columns: 1fr;
  }

  .send-chat-button {
    min-height: 45px;
  }

  .case-header {
    align-items: flex-start;
  }

  .item-card {
    padding: 13px;
  }

  .chat-footer {
    line-height: 1.5;
  }
}

`;