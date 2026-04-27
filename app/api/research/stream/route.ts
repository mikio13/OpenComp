import { NextRequest, NextResponse } from "next/server";
import { synthesizeResearchSummary } from "@/features/research/server/openai-synthesis.server";
import { runCompetitorResearch } from "@/features/research/server/tinyfish.server";
import type {
  BrowserProfile,
  ResearchCompetitorResult,
  ResearchStreamEvent,
  ResearchTargetKind,
} from "@/features/research/types";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnvVars } from "@/lib/utils";

const MAX_COMPETITORS = 5;

interface ResearchTarget {
  url: string;
  kind: ResearchTargetKind;
  label: string;
}

interface ResearchRequestBody {
  competitorUrls?: unknown;
  prompt?: unknown;
  ownWebsite?: unknown;
  browserProfile?: unknown;
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

function buildTargets({
  competitorUrls,
  ownWebsite,
}: {
  competitorUrls: string[];
  ownWebsite: string | null;
}): ResearchTarget[] {
  return [
    ...competitorUrls.map((url, index) => ({
      url,
      kind: "competitor" as const,
      label:
        competitorUrls.length === 1
          ? "Competitor"
          : `Competitor ${index + 1}`,
    })),
    ...(ownWebsite
      ? [
          {
            url: ownWebsite,
            kind: "own" as const,
            label: "Your site",
          },
        ]
      : []),
  ];
}

function parseBody(body: ResearchRequestBody): {
  competitorUrls: string[];
  prompt: string;
  ownWebsite: string | null;
  browserProfile: BrowserProfile;
} {
  if (!Array.isArray(body.competitorUrls)) {
    throw new Error("Add at least one competitor website.");
  }

  const competitorUrls = Array.from(
    new Set(
      body.competitorUrls
        .filter((value): value is string => typeof value === "string")
        .map((url) => normalizeUrl(url)),
    ),
  ).slice(0, MAX_COMPETITORS);

  if (competitorUrls.length === 0) {
    throw new Error("Add at least one competitor website.");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (prompt.length < 12) {
    throw new Error("Write a more specific research prompt.");
  }

  if (typeof body.ownWebsite !== "string" || !body.ownWebsite.trim()) {
    throw new Error("Add your own website so OpenComp can run both sessions.");
  }

  const ownWebsite = normalizeUrl(body.ownWebsite);

  const browserProfile =
    body.browserProfile === "lite" || body.browserProfile === "stealth"
      ? body.browserProfile
      : "stealth";

  return {
    competitorUrls,
    prompt,
    ownWebsite,
    browserProfile,
  };
}

async function requireUserIfConfigured() {
  if (!hasSupabaseEnvVars) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }
}

function streamEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: ResearchStreamEvent,
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(request: NextRequest) {
  if (!process.env.TINYFISH_API_KEY) {
    return NextResponse.json(
      { error: "Missing TINYFISH_API_KEY environment variable." },
      { status: 500 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 },
    );
  }

  let parsed: ReturnType<typeof parseBody>;

  try {
    const body = (await request.json()) as ResearchRequestBody;
    parsed = parseBody(body);
    await requireUserIfConfigured();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: error instanceof Error && error.message === "Unauthorized." ? 401 : 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ResearchStreamEvent) => {
        streamEvent(controller, encoder, event);
      };

      const results: ResearchCompetitorResult[] = [];
      const targets = buildTargets({
        competitorUrls: parsed.competitorUrls,
        ownWebsite: parsed.ownWebsite,
      });

      try {
        send({
          type: "RUN_STARTED",
          competitorCount: parsed.competitorUrls.length,
          ownWebsiteIncluded: Boolean(parsed.ownWebsite),
        });

        const runTarget = async (target: ResearchTarget, index: number) => {
          send({
            type: "COMPETITOR_STARTED",
            url: target.url,
            kind: target.kind,
            label: target.label,
            index: index + 1,
            total: targets.length,
          });

          try {
            const result = await runCompetitorResearch({
              url: target.url,
              kind: target.kind,
              label: target.label,
              prompt: parsed.prompt,
              browserProfile: parsed.browserProfile,
              send,
            });

            results.push(result);
            send({ type: "COMPETITOR_COMPLETE", result });
          } catch (error) {
            const result: ResearchCompetitorResult = {
              url: target.url,
              kind: target.kind,
              label: target.label,
              status: "error",
              observation: "",
              screenshotUrl: null,
              tinyfishRunId: null,
              streamingUrl: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Competitor research failed.",
            };

            results.push(result);
            send({ type: "COMPETITOR_ERROR", result });
          }
        };

        await Promise.all(targets.map((target, index) => runTarget(target, index)));

        const completedResults = results.filter(
          (result) => result.status === "complete",
        );

        if (completedResults.length === 0) {
          send({
            type: "ERROR",
            error: "No competitor research completed successfully.",
          });
          return;
        }

        send({ type: "SYNTHESIS_STARTED" });

        const summary = await synthesizeResearchSummary({
          results: completedResults,
          prompt: parsed.prompt,
          ownWebsite: parsed.ownWebsite,
        });

        send({
          type: "RESEARCH_COMPLETE",
          results,
          summary,
        });
      } catch (error) {
        send({
          type: "ERROR",
          error:
            error instanceof Error
              ? error.message
              : "Research stream failed unexpectedly.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
