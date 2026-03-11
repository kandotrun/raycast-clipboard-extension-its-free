import {
  List,
  ActionPanel,
  Action,
  Icon,
  getPreferenceValues,
  showToast,
  Toast,
  confirmAlert,
  Alert,
} from "@raycast/api";
import { useState, useEffect, useMemo, useCallback } from "react";
import Database from "better-sqlite3";
import { homedir } from "os";
import path from "path";

interface ClipboardEntry {
  id: number;
  content: string;
  content_type: string;
  source_app: string | null;
  content_hash: string;
  created_at: number;
  pinned: number;
}

interface Preferences {
  databasePath: string;
}

const PAGE_SIZE = 200;

function resolveDbPath(dbPath: string): string {
  if (dbPath.startsWith("~")) {
    return path.join(homedir(), dbPath.slice(1));
  }
  return dbPath;
}

function getDb(): Database.Database {
  const prefs = getPreferenceValues<Preferences>();
  const dbPath = resolveDbPath(prefs.databasePath);
  return new Database(dbPath, { readonly: false });
}

function getIcon(contentType: string): Icon {
  switch (contentType) {
    case "url":
      return Icon.Link;
    case "email":
      return Icon.Envelope;
    case "path":
      return Icon.Finder;
    default:
      return Icon.Document;
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} min ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diff / 86400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getDateSection(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp * 1000);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000);

  if (date >= todayStart) return "Today";
  if (date >= yesterdayStart) return "Yesterday";
  if (date >= weekStart) return "This Week";
  return "Older";
}

function truncateContent(content: string, maxLen = 80): string {
  const firstLine = content.split("\n")[0];
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + "…";
}

export default function SearchClipboardVault() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback((search: string) => {
    setIsLoading(true);
    try {
      const db = getDb();
      let rows: ClipboardEntry[];
      if (search) {
        const stmt = db.prepare(
          "SELECT * FROM clipboard WHERE content LIKE ? ORDER BY pinned DESC, created_at DESC LIMIT ?",
        );
        rows = stmt.all(`%${search}%`, PAGE_SIZE) as ClipboardEntry[];
      } else {
        const stmt = db.prepare(
          "SELECT * FROM clipboard ORDER BY pinned DESC, created_at DESC LIMIT ?",
        );
        rows = stmt.all(PAGE_SIZE) as ClipboardEntry[];
      }
      db.close();
      setEntries(rows);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries(searchText);
  }, [searchText, loadEntries]);

  const grouped = useMemo(() => {
    const sections: Record<string, ClipboardEntry[]> = {};
    const order = ["Today", "Yesterday", "This Week", "Older"];
    for (const entry of entries) {
      const section = getDateSection(entry.created_at);
      if (!sections[section]) sections[section] = [];
      sections[section].push(entry);
    }
    return order.filter((s) => sections[s]).map((s) => ({ title: s, entries: sections[s] }));
  }, [entries]);

  const togglePin = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        const db = getDb();
        const newPinned = entry.pinned ? 0 : 1;
        db.prepare("UPDATE clipboard SET pinned = ? WHERE id = ?").run(newPinned, entry.id);
        db.close();
        await showToast({ style: Toast.Style.Success, title: newPinned ? "Pinned" : "Unpinned" });
        loadEntries(searchText);
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to update pin",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [searchText, loadEntries],
  );

  const deleteEntry = useCallback(
    async (entry: ClipboardEntry) => {
      const confirmed = await confirmAlert({
        title: "Delete Entry",
        message: "Are you sure you want to delete this clipboard entry?",
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      });
      if (!confirmed) return;
      try {
        const db = getDb();
        db.prepare("DELETE FROM clipboard WHERE id = ?").run(entry.id);
        db.close();
        await showToast({ style: Toast.Style.Success, title: "Deleted" });
        loadEntries(searchText);
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [searchText, loadEntries],
  );

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Database Error"
          description={error}
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search clipboard history…"
      onSearchTextChange={setSearchText}
      isShowingDetail
      throttle
    >
      {grouped.map((section) => (
        <List.Section key={section.title} title={section.title}>
          {section.entries.map((entry) => {
            const subtitle = [entry.source_app, getRelativeTime(entry.created_at)]
              .filter(Boolean)
              .join(" · ");

            return (
              <List.Item
                key={entry.id}
                icon={entry.pinned ? Icon.Pin : getIcon(entry.content_type)}
                title={truncateContent(entry.content)}
                accessories={[{ text: subtitle }]}
                detail={
                  <List.Item.Detail
                    markdown={`\`\`\`\n${entry.content}\n\`\`\``}
                  />
                }
                actions={
                  <ActionPanel>
                    <Action.Paste title="Paste to Active App" content={entry.content} />
                    <Action.CopyToClipboard
                      title="Copy to Clipboard"
                      content={entry.content}
                      shortcut={{ modifiers: ["cmd"], key: "return" }}
                    />
                    <Action
                      title={entry.pinned ? "Unpin Entry" : "Pin Entry"}
                      icon={Icon.Pin}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                      onAction={() => togglePin(entry)}
                    />
                    <Action
                      title="Delete Entry"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      onAction={() => deleteEntry(entry)}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
    </List>
  );
}
