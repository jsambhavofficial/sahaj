"use client";

import React, { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { isPushNotificationSupported, registerWebPushToken } from "@/services/fcm";

type State = "hidden" | "ask" | "denied" | "on" | "error";

/** Lets any signed-in user turn on browser push. The click is the user gesture browsers require for the prompt. */
export const PushEnableButton: React.FC<{ floating?: boolean }> = ({ floating = false }) => {
  const [state, setState] = useState<State>("hidden");
  const [message, setMessage] = useState("");

  const run = async () => {
    const r = await registerWebPushToken();
    if (r.permission === "denied") setState("denied");
    else if (r.token) setState("on");
    else {
      setMessage(r.error || "Could not turn on notifications.");
      setState("error");
    }
  };

  useEffect(() => {
    if (!isPushNotificationSupported()) return;
    const p = Notification.permission;
    if (p === "granted") void run(); // refresh the device token silently
    else setState(p === "denied" ? "denied" : "ask");
  }, []);

  if (state === "hidden" || state === "on") return null;

  const blocked = state === "denied";
  return (
    <button
      type="button"
      onClick={blocked ? undefined : () => void run()}
      title={
        blocked
          ? "Notifications are blocked for this site. Allow them in the browser's site settings, then reload."
          : state === "error"
            ? message
            : "Get alerts on this device"
      }
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        floating ? "fixed bottom-4 right-4 z-50 bg-white shadow-lg border border-slate-200" : ""
      } ${
        blocked ? "text-slate-400 cursor-not-allowed" : "text-brand-700 bg-brand-50 hover:bg-brand-100"
      }`}
    >
      {blocked ? <BellOff className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
      <span className="hidden sm:inline">{blocked ? "Notifications blocked" : state === "error" ? "Retry notifications" : "Enable notifications"}</span>
    </button>
  );
};
