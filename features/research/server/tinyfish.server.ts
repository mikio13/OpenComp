import type {
  BrowserProfile,
  ResearchCompetitorResult,
  ResearchStreamEvent,
  ResearchTargetKind,
} from "@/features/research/types";

const TINYFISH_STREAM_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

interface TinyFishSseEvent {
  type?: string;
  run_id?: string;
  streaming_url?: string;
  result?: unknown;
  status?: string;
  error?: string;
  screenshot_url?: string;
}

interface RunCompetitorInput {
  url: string;
  kind: ResearchTargetKind;
  label: string;
  prompt: string;
  browserProfile: BrowserProfile;
  send: (event: ResearchStreamEvent) => void;
}

function stringifyResult(result: unknown): string {
  if (typeof result === "string") {
    return result.trim();
  }

  if (result === null || result === undefined) {
    return "";
  }

  return JSON.stringify(result, null, 2);
}

function getTinyFishEventMessage(event: TinyFishSseEvent): string {
  if (event.type === "STARTED") {
    return "TinyFish started the shopping session.";
  }

  if (event.type === "STREAMING_URL") {
    return "Browser stream is available.";
  }

  if (event.type === "COMPLETE") {
    return "Competitor checkout research finished.";
  }

  if (event.type === "ERROR") {
    return event.error ?? "TinyFish reported an error.";
  }

  return event.type ?? "TinyFish emitted an update.";
}

function buildMysteryShopperGoal({
  prompt,
  kind,
}: {
  prompt: string;
  kind: ResearchTargetKind;
}) {
  return [
    kind === "own"
      ? "Act as a careful mystery shopper auditing our own checkout funnel."
      : "Act as a careful mystery shopper researching a competitor checkout funnel.",
    "Start from the target URL. Inspect pricing, packaging, trial or demo motion, checkout steps, payment flow, discounting, trust signals, and conversion friction.",
    "Do not make a purchase, submit payment details, create unnecessary accounts, or bypass authentication. Stop before any irreversible order or payment confirmation.",
    "Analyze only this one target website. Do not compare it against any other company, product, website, or pricing page.",
    `Research brief: ${prompt}`,
    "Return only a compact evidence report. Use short bullets. Include exact observed prices, trial terms, discounts, checkout steps, blockers, and notable copy when visible. Do not write strategy recommendations; another model will synthesize the strategy.",
  ].join("\n\n");
}

export async function runCompetitorResearch({
  url,
  kind,
  label,
  prompt,
  browserProfile,
  send,
}: RunCompetitorInput): Promise<ResearchCompetitorResult> {
  const response = await fetch(TINYFISH_STREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TINYFISH_API_KEY!,
    },
    body: JSON.stringify({
      url,
      goal: buildMysteryShopperGoal({ prompt, kind }),
      browser_profile: browserProfile,
    }),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(
      errorText ||
        "TinyFish streaming request failed before research could start.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let observation = "";
  let screenshotUrl: string | null = null;
  let tinyfishRunId: string | null = null;
  let streamingUrl: string | null = null;
  let completed = false;

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

      let event: TinyFishSseEvent;
      try {
        event = JSON.parse(rawPayload) as TinyFishSseEvent;
      } catch {
        continue;
      }

      if (event.run_id) {
        tinyfishRunId = event.run_id;
      }

      if (event.streaming_url) {
        streamingUrl = event.streaming_url;
      }

      if (event.screenshot_url) {
        screenshotUrl = event.screenshot_url;
      }

      const resultText = stringifyResult(event.result);
      if (resultText) {
        observation = resultText;
      }

      send({
        type: "TINYFISH_EVENT",
        url,
        kind,
        label,
        eventType: event.type ?? "UPDATE",
        message: getTinyFishEventMessage(event),
        runId: tinyfishRunId,
        streamingUrl,
      });

      if (event.type === "ERROR") {
        throw new Error(event.error ?? "TinyFish reported an error.");
      }

      if (event.type === "COMPLETE") {
        completed = true;
        break;
      }
    }

    if (completed) {
      break;
    }
  }

  if (!completed) {
    throw new Error("TinyFish stream ended before completion.");
  }

  return {
    url,
    kind,
    label,
    status: "complete",
    observation:
      observation || "TinyFish completed the run but returned no observation.",
    screenshotUrl,
    tinyfishRunId,
    streamingUrl,
    error: null,
  };
}
