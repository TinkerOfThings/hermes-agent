import { Activity, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { HealthCheck, HealthResponse } from "@/lib/api";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

type Tone = "success" | "warning" | "destructive" | "outline";

const STATUS_TONE: Record<string, Tone> = {
  up: "success",
  ok: "success",
  down: "destructive",
  unknown: "warning",
};

// Human label for a check key. Platform pollers arrive as "platform:<name>".
function prettyLabel(key: string): string {
  if (key.startsWith("platform:")) return key.slice("platform:".length);
  const map: Record<string, string> = {
    gateway: "Gateway",
    pty_sessions: "Chat terminals",
    lmstudio: "LM Studio",
    platforms: "Platforms",
  };
  return map[key] ?? key.replace(/_/g, " ");
}

// One-line detail synthesised from whichever fields the check carries.
function detailOf(check: HealthCheck): string | null {
  const parts: string[] = [];
  if (check.state) parts.push(String(check.state));
  if (check.pid) parts.push(`pid ${check.pid}`);
  if (typeof check.live === "number") {
    parts.push(`${check.live} live / ${check.total ?? check.live} total`);
  }
  if (typeof check.models === "number") parts.push(`${check.models} model(s)`);
  if (check.base_url) parts.push(check.base_url);
  if (check.detail) parts.push(check.detail);
  if (check.error) parts.push(check.error);
  return parts.length ? parts.join(" · ") : null;
}

export function HealthCard({ health }: HealthCardProps) {
  if (!health) return null;
  const entries = Object.entries(health.checks);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">System health</CardTitle>
          <Badge
            tone={health.ok ? "success" : "destructive"}
            className="ml-auto shrink-0"
          >
            {health.ok ? "All systems go" : "Attention"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3">
        {entries.map(([key, check]) => {
          const tone = STATUS_TONE[check.status] ?? "outline";
          const IconComponent =
            tone === "success"
              ? CheckCircle2
              : tone === "destructive"
                ? XCircle
                : HelpCircle;
          const detail = detailOf(check);

          return (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-border p-3 w-full"
            >
              <div className="flex items-center gap-3 min-w-0 w-full">
                <IconComponent
                  className={`h-4 w-4 shrink-0 ${
                    tone === "success"
                      ? "text-success"
                      : tone === "destructive"
                        ? "text-destructive"
                        : "text-warning"
                  }`}
                />

                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-mondwest normal-case text-sm font-medium capitalize truncate">
                    {prettyLabel(key)}
                  </span>
                  {detail && (
                    <span className="font-mondwest normal-case text-xs text-muted-foreground truncate">
                      {detail}
                    </span>
                  )}
                </div>
              </div>

              <Badge tone={tone} className="shrink-0 self-start sm:self-center">
                {tone === "success" && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                )}
                {check.status}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface HealthCardProps {
  health: HealthResponse | null;
}
