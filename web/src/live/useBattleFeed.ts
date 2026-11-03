import { useEffect, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import type { RunView } from "@/api/types";

export type FeedStatus = "connecting" | "live" | "reconnecting" | "offline";

/** Joins the run's SignalR group and hands every new state to `onState`. */
export function useBattleFeed(runId: string | null, onState: (run: RunView) => void): FeedStatus {
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const handler = useRef(onState);
  handler.current = onState;

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const connection = new HubConnectionBuilder()
      .withUrl("hubs/battle")
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("state", (run: RunView) => handler.current(run));
    connection.onreconnecting(() => setStatus("reconnecting"));
    connection.onreconnected(async () => {
      await connection.invoke("Watch", runId);
      setStatus("live");
    });
    connection.onclose(() => {
      if (!stopped) setStatus("offline");
    });

    setStatus("connecting");
    (async () => {
      try {
        await connection.start();
        await connection.invoke("Watch", runId);
        if (!stopped) setStatus("live");
      } catch {
        if (!stopped) setStatus("offline");
      }
    })();

    return () => {
      stopped = true;
      void connection.stop();
    };
  }, [runId]);

  return status;
}
