"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  BrowserProfile,
  ResearchCompetitorResult,
  ResearchStreamEvent,
  ResearchSummary,
  ResearchTargetKind,
} from "@/features/research/types";

interface LogEntry {
  id: string;
  text: string;
  tone: "muted" | "good" | "bad";
}

const defaultPrompt =
  "Compare pricing tiers, checkout friction, discounting, trial motion, and the fastest path from pricing page to payment.";

function createEmptyResult({
  url,
  kind = "competitor",
  label = "Competitor",
}: {
  url: string;
  kind?: ResearchTargetKind;
  label?: string;
}): ResearchCompetitorResult {
  return {
    url,
    kind,
    label,
    status: "pending",
    observation: "",
    screenshotUrl: null,
    tinyfishRunId: null,
    streamingUrl: null,
    error: null,
  };
}

function getHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function appendLog(
  current: LogEntry[],
  text: string,
  tone: LogEntry["tone"] = "muted",
) {
  return [
    {
      id:
        globalThis.crypto?.randomUUID() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      tone,
    },
    ...current,
  ].slice(0, 12);
}

export function ResearchWorkbench() {
  const [competitorUrls, setCompetitorUrls] = useState([""]);
  const [ownWebsite, setOwnWebsite] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [browserProfile, setBrowserProfile] =
    useState<BrowserProfile>("stealth");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResearchCompetitorResult[]>([]);
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null,
  );
  const summaryRef = useRef<HTMLDivElement | null>(null);

  const cleanedCompetitorUrls = useMemo(
    () => competitorUrls.map((url) => url.trim()).filter(Boolean),
    [competitorUrls],
  );

  const canRun =
    cleanedCompetitorUrls.length > 0 &&
    ownWebsite.trim().length > 0 &&
    prompt.trim().length >= 12 &&
    !isRunning;

  const competitorPreviewResult = useMemo(() => {
    const selected = results.find(
      (result) =>
        result.kind === "competitor" &&
        result.url === selectedPreviewUrl &&
        result.streamingUrl,
    );

    return (
      selected ??
      results.find(
        (result) =>
          result.kind === "competitor" &&
          result.status === "running" &&
          result.streamingUrl,
      ) ??
      results.find(
        (result) => result.kind === "competitor" && result.streamingUrl,
      ) ??
      null
    );
  }, [results, selectedPreviewUrl]);

  const ownPreviewResult = useMemo(
    () => results.find((result) => result.kind === "own" && result.streamingUrl) ?? null,
    [results],
  );

  const updateCompetitorUrl = (index: number, value: string) => {
    setCompetitorUrls((current) =>
      current.map((url, currentIndex) =>
        currentIndex === index ? value : url,
      ),
    );
  };

  const addCompetitor = () => {
    setCompetitorUrls((current) =>
      current.length >= 5 ? current : [...current, ""],
    );
  };

  const removeCompetitor = (index: number) => {
    setCompetitorUrls((current) =>
      current.length === 1
        ? [""]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const applyEvent = (event: ResearchStreamEvent) => {
    if (event.type === "RUN_STARTED") {
      setLogs((current) =>
        appendLog(
          current,
          `Research started for ${event.competitorCount} competitor site(s)${
            event.ownWebsiteIncluded ? " and your site" : ""
          }.`,
        ),
      );
      return;
    }

    if (event.type === "COMPETITOR_STARTED") {
      setResults((current) => {
        const existing = current.filter((result) => result.url !== event.url);
        return [
          ...existing,
          {
            ...createEmptyResult({
              url: event.url,
              kind: event.kind,
              label: event.label,
            }),
            status: "running",
          },
        ];
      });
      setLogs((current) =>
        appendLog(
          current,
          `${event.index}/${event.total}: mystery shopping ${event.label}.`,
        ),
      );
      return;
    }

    if (event.type === "TINYFISH_EVENT") {
      if (event.streamingUrl && event.kind === "competitor") {
        setSelectedPreviewUrl(event.url);
      }

      setResults((current) =>
        current.map((result) =>
          result.url === event.url
            ? {
                ...result,
                kind: event.kind,
                label: event.label,
                tinyfishRunId: event.runId,
                streamingUrl: event.streamingUrl,
              }
            : result,
        ),
      );
      setLogs((current) =>
        appendLog(current, `${getHost(event.url)}: ${event.message}`),
      );
      return;
    }

    if (event.type === "SYNTHESIS_STARTED") {
      setLogs((current) =>
        appendLog(current, "Synthesizing observations with OpenAI."),
      );
      return;
    }

    if (event.type === "COMPETITOR_COMPLETE") {
      setResults((current) => [
        ...current.filter((result) => result.url !== event.result.url),
        event.result,
      ]);
      setLogs((current) =>
        appendLog(
          current,
          `${getHost(event.result.url)} report complete.`,
          "good",
        ),
      );
      return;
    }

    if (event.type === "COMPETITOR_ERROR") {
      setResults((current) => [
        ...current.filter((result) => result.url !== event.result.url),
        event.result,
      ]);
      setLogs((current) =>
        appendLog(
          current,
          `${getHost(event.result.url)} failed: ${event.result.error}`,
          "bad",
        ),
      );
      return;
    }

    if (event.type === "RESEARCH_COMPLETE") {
      setResults(event.results);
      setSummary(event.summary);
      setIsRunning(false);
      setLogs((current) => appendLog(current, "Research run finished.", "good"));
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    if (event.type === "ERROR") {
      setError(event.error);
      setIsRunning(false);
      setLogs((current) => appendLog(current, event.error, "bad"));
    }
  };

  const runResearch = async () => {
    if (!canRun) {
      return;
    }

    setIsRunning(true);
    setError(null);
    setSummary(null);
    setResults([
      ...cleanedCompetitorUrls.map((url, index) =>
        createEmptyResult({
          url,
          kind: "competitor",
          label:
            cleanedCompetitorUrls.length === 1
              ? "Competitor"
              : `Competitor ${index + 1}`,
        }),
      ),
      ...(ownWebsite.trim()
        ? [
            createEmptyResult({
              url: ownWebsite.trim(),
              kind: "own",
              label: "Your site",
            }),
          ]
        : []),
    ]);
    setLogs([]);
    setSelectedPreviewUrl(null);

    try {
      const response = await fetch("/api/research/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitorUrls: cleanedCompetitorUrls,
          ownWebsite,
          prompt,
          browserProfile,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Research request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((line) => line.trim().startsWith("data:"));

          if (!dataLine) {
            continue;
          }

          const rawPayload = dataLine.replace(/^data:\s*/, "").trim();
          if (!rawPayload) {
            continue;
          }

          applyEvent(JSON.parse(rawPayload) as ResearchStreamEvent);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Research request failed.";
      setError(message);
      setLogs((current) => appendLog(current, message, "bad"));
      setIsRunning(false);
    }
  };

  const renderPreviewWindow = ({
    title,
    result,
    idleCopy,
  }: {
    title: string;
    result: ResearchCompetitorResult | null;
    idleCopy: string;
  }) => (
    <div className="overflow-hidden rounded-2xl border border-[#30302e] bg-[#1f1f1d]">
      <div className="flex items-center justify-between gap-3 border-b border-[#30302e] bg-[#30302e] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#faf9f5]">{title}</p>
          <p className="truncate text-xs text-[#87867f]">
            {result?.streamingUrl ?? "Waiting for STREAMING_URL"}
          </p>
        </div>
        {result?.streamingUrl ? (
          <a
            href={result.streamingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#141413] px-3 py-2 text-xs font-medium text-[#faf9f5] shadow-[0_0_0_1px_#30302e]"
          >
            Open
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      {result?.streamingUrl ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={result.streamingUrl}
            title={`TinyFish live browser for ${getHost(result.url)}`}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <p className="text-xs font-medium uppercase text-[#87867f]">
              {isRunning ? "Waiting for live browser" : "Idle"}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#b0aea5]">
              {isRunning ? idleCopy : "Run research to watch this TinyFish session."}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
      <section className="rounded-2xl bg-[#faf9f5] p-5 shadow-[0_0_0_1px_#f0eee6,0_4px_24px_rgba(0,0,0,0.05)] sm:p-7">
        <div className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase text-[#c96442]">
            Competitor research
          </p>
          <h1 className="font-serif text-4xl font-medium leading-[1.12] text-[#141413] sm:text-5xl">
            Mystery-shop competitor funnels.
          </h1>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-3">
            <Label className="text-[#4d4c48]">Competitor websites</Label>
            {competitorUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(event) =>
                    updateCompetitorUrl(index, event.target.value)
                  }
                  placeholder="https://competitor.com/pricing"
                  className="h-11 rounded-xl border-[#e8e6dc] bg-white text-[#141413] shadow-[0_0_0_1px_#f0eee6] focus-visible:ring-[#3898ec]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeCompetitor(index)}
                  className="h-11 w-11 rounded-xl border-[#e8e6dc] bg-[#faf9f5] text-[#5e5d59] shadow-[0_0_0_1px_#f0eee6]"
                  aria-label="Remove competitor"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={addCompetitor}
              disabled={competitorUrls.length >= 5}
              className="h-10 w-fit rounded-lg bg-[#e8e6dc] px-3 text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] hover:bg-[#dedbd0]"
            >
              <Plus className="size-4" />
              Add site
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="own-website" className="text-[#4d4c48]">
              Your pricing page
            </Label>
            <Input
              id="own-website"
              value={ownWebsite}
              onChange={(event) => setOwnWebsite(event.target.value)}
              placeholder="https://yourcompany.com/pricing"
              className="h-11 rounded-xl border-[#e8e6dc] bg-white text-[#141413] shadow-[0_0_0_1px_#f0eee6] focus-visible:ring-[#3898ec]"
            />
            <p className="text-xs leading-5 text-[#87867f]">
              OpenComp runs this as a separate TinyFish session alongside the
              competitor session.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="research-prompt" className="text-[#4d4c48]">
              Research prompt
            </Label>
            <textarea
              id="research-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-32 resize-y rounded-xl border border-[#e8e6dc] bg-white px-3 py-3 text-sm leading-6 text-[#141413] shadow-[0_0_0_1px_#f0eee6] placeholder:text-[#87867f] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3898ec]"
            />
          </div>

          <div className="flex flex-col justify-between gap-4 border-t border-[#e8e6dc] pt-5 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl bg-[#e8e6dc] p-1 shadow-[0_0_0_1px_#d1cfc5]">
              {(["stealth", "lite"] as BrowserProfile[]).map((profile) => (
                <button
                  key={profile}
                  type="button"
                  onClick={() => setBrowserProfile(profile)}
                  className={`h-9 rounded-lg px-4 text-sm font-medium transition ${
                    browserProfile === profile
                      ? "bg-[#141413] text-[#faf9f5]"
                      : "text-[#4d4c48] hover:bg-[#faf9f5]"
                  }`}
                >
                  {profile === "stealth" ? "Stealth" : "Lite"}
                </button>
              ))}
            </div>

            <Button
              onClick={runResearch}
              disabled={!canRun}
              className="h-11 rounded-xl bg-[#c96442] px-5 text-[#faf9f5] shadow-[0_0_0_1px_#c96442] hover:bg-[#b95739]"
            >
              {isRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Run research
            </Button>
          </div>

          {error ? (
            <div className="flex gap-3 rounded-xl border border-[#b53333]/25 bg-[#b53333]/10 p-4 text-sm text-[#7e2424]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-[#141413] p-5 text-[#faf9f5] shadow-[0_0_0_1px_#30302e] sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-medium uppercase text-[#d97757]">
              Live report
            </p>
            <h2 className="font-serif text-3xl font-medium leading-[1.15]">
              Pricing and checkout intelligence.
            </h2>
          </div>
          <div className="rounded-full bg-[#30302e] p-3 text-[#d97757] shadow-[0_0_0_1px_#30302e]">
            <BadgeDollarSign className="size-5" />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 2xl:grid-cols-2">
            {renderPreviewWindow({
              title: "Competitor live browser",
              result: competitorPreviewResult,
              idleCopy:
                "This panel will attach when a competitor session emits a browser stream.",
            })}
            {renderPreviewWindow({
              title: "Your site live browser",
              result: ownPreviewResult,
              idleCopy:
                "This panel will attach when your own site session emits a browser stream.",
            })}
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-[#30302e] bg-[#30302e] p-5">
              <div className="mb-5 h-28 rounded-2xl bg-[#faf9f5] p-4 text-[#141413]">
                <div className="h-2 w-24 rounded-full bg-[#c96442]" />
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="h-12 rounded-xl bg-[#e8e6dc]" />
                  <div className="h-12 rounded-xl bg-[#d8d6ca]" />
                  <div className="h-12 rounded-xl bg-[#b9c5a7]" />
                </div>
                <div className="mt-4 h-2 w-40 rounded-full bg-[#87867f]" />
              </div>
              <p className="text-sm leading-6 text-[#b0aea5]">
                Awaiting report.
              </p>
            </div>
          ) : (
            results.map((result) => (
              <article
                key={result.url}
                className="rounded-2xl border border-[#30302e] bg-[#1f1f1d] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#faf9f5]">
                      {result.label}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#87867f]">
                      {result.url}
                    </p>
                  </div>
                  {result.status === "complete" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-[#b9c5a7]" />
                  ) : result.status === "error" ? (
                    <AlertTriangle className="size-5 shrink-0 text-[#d97757]" />
                  ) : (
                    <Loader2 className="size-5 shrink-0 animate-spin text-[#d97757]" />
                  )}
                </div>

                {result.observation ? (
                  <p className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[#b0aea5]">
                    {result.observation}
                  </p>
                ) : result.error ? (
                  <p className="mt-4 text-sm leading-6 text-[#d97757]">
                    {result.error}
                  </p>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[#87867f]">
                    Research in progress.
                  </p>
                )}

                {result.streamingUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (result.kind === "competitor") {
                        setSelectedPreviewUrl(result.url);
                      }
                    }}
                    className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium shadow-[0_0_0_1px_#30302e] ${
                      competitorPreviewResult?.url === result.url ||
                      ownPreviewResult?.url === result.url
                        ? "bg-[#c96442] text-[#faf9f5]"
                        : "bg-[#30302e] text-[#faf9f5]"
                    }`}
                  >
                    {competitorPreviewResult?.url === result.url ||
                    ownPreviewResult?.url === result.url
                      ? "Viewing stream"
                      : "View stream"}
                  </button>
                ) : null}
              </article>
            ))
          )}

          {summary ? (
            <div
              ref={summaryRef}
              className="scroll-mt-6 rounded-2xl border border-[#30302e] bg-[#faf9f5] p-4 text-[#141413]"
            >
              <h3 className="font-serif text-2xl font-medium">
                {summary.headline}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#5e5d59]">
                {summary.executiveSummary}
              </p>

              <div className="mt-5 grid gap-3">
                {summary.competitorFindings.map((finding, index) => (
                  <div
                    key={`${finding.url}-${index}`}
                    className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_#f0eee6]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-serif text-lg font-medium">
                        {getHost(finding.url)}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#e8e6dc] px-2 py-1 text-xs text-[#4d4c48]">
                        Finding
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5e5d59]">
                      {finding.summary}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-[#5e5d59]">
                      <p>
                        <span className="font-medium text-[#141413]">
                          Pricing:
                        </span>{" "}
                        {finding.pricing}
                      </p>
                      <p>
                        <span className="font-medium text-[#141413]">
                          Checkout:
                        </span>{" "}
                        {finding.checkout}
                      </p>
                      <p>
                        <span className="font-medium text-[#141413]">
                          Friction:
                        </span>{" "}
                        {finding.friction}
                      </p>
                    </div>
                    <p className="mt-3 rounded-lg bg-[#f5f4ed] p-2 text-xs leading-5 text-[#87867f]">
                      {finding.evidence}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {summary.opportunities.map((opportunity, index) => (
                  <p
                    key={`opportunity-${index}`}
                    className="rounded-xl bg-[#f5f4ed] p-3 text-sm leading-6 text-[#5e5d59] shadow-[0_0_0_1px_#e8e6dc]"
                  >
                    {opportunity}
                  </p>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {summary.stripeActions.map((action, index) => (
                  <div
                    key={`stripe-action-${index}`}
                    className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_#f0eee6]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-serif text-lg font-medium">
                        {action.title}
                      </p>
                      <span className="rounded-full bg-[#e8e6dc] px-2 py-1 text-xs text-[#4d4c48]">
                        {action.apiHint}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5e5d59]">
                      {action.detail}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#87867f]">
                      {action.evidence}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-[#141413] p-4 text-[#faf9f5] shadow-[0_0_0_1px_#30302e]">
                <p className="font-serif text-xl font-medium">
                  Stripe implementation handoff
                </p>
                <p className="mt-2 text-sm leading-6 text-[#b0aea5]">
                  Paste this into Codex in your own product repository. Review
                  all generated changes before touching live Stripe resources.
                </p>

                <div className="mt-4 rounded-xl bg-[#30302e] p-3 shadow-[0_0_0_1px_#30302e]">
                  <p className="mb-2 text-xs font-medium uppercase text-[#87867f]">
                    Codex prompt
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[#faf9f5]">
                    {summary.stripeImplementation?.codexPrompt ??
                      "Run a new research job to generate a Stripe implementation handoff."}
                  </pre>
                </div>

                <div className="mt-4 grid gap-3">
                  {(summary.stripeImplementation?.codeSnippets ?? []).map(
                    (snippet, index) => (
                      <div
                        key={`stripe-snippet-${index}`}
                        className="rounded-xl bg-[#1f1f1d] p-3 shadow-[0_0_0_1px_#30302e]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-serif text-lg font-medium">
                              {snippet.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[#b0aea5]">
                              {snippet.description}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#30302e] px-2 py-1 text-xs text-[#b0aea5]">
                            curl
                          </span>
                        </div>
                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#141413] p-3 text-xs leading-5 text-[#faf9f5]">
                          {snippet.command}
                        </pre>
                        <p className="mt-2 text-xs leading-5 text-[#87867f]">
                          {snippet.notes}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div className="rounded-2xl border border-[#30302e] bg-[#1f1f1d] p-4">
              <p className="mb-3 text-xs font-medium uppercase text-[#87867f]">
                Event log
              </p>
              <div className="grid gap-2">
                {logs.map((log) => (
                  <p
                    key={log.id}
                    className={`text-xs leading-5 ${
                      log.tone === "good"
                        ? "text-[#b9c5a7]"
                        : log.tone === "bad"
                          ? "text-[#d97757]"
                          : "text-[#b0aea5]"
                    }`}
                  >
                    {log.text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
