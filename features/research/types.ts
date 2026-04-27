export type BrowserProfile = "lite" | "stealth";

export type CompetitorStatus = "pending" | "running" | "complete" | "error";
export type ResearchTargetKind = "competitor" | "own";

export interface ResearchCompetitorResult {
  url: string;
  kind: ResearchTargetKind;
  label: string;
  status: CompetitorStatus;
  observation: string;
  screenshotUrl: string | null;
  tinyfishRunId: string | null;
  streamingUrl: string | null;
  error: string | null;
}

export interface StripeAction {
  title: string;
  detail: string;
  apiHint: string;
  risk: "low" | "medium" | "high";
  evidence: string;
}

export interface StripeCodeSnippet {
  title: string;
  description: string;
  command: string;
  notes: string;
}

export interface StripeImplementationHandoff {
  codexPrompt: string;
  codeSnippets: StripeCodeSnippet[];
}

export interface CompetitorFinding {
  url: string;
  summary: string;
  pricing: string;
  checkout: string;
  friction: string;
  evidence: string;
}

export interface ResearchSummary {
  headline: string;
  executiveSummary: string;
  competitorFindings: CompetitorFinding[];
  opportunities: string[];
  stripeActions: StripeAction[];
  stripeImplementation: StripeImplementationHandoff;
}

export type ResearchStreamEvent =
  | {
      type: "RUN_STARTED";
      competitorCount: number;
      ownWebsiteIncluded: boolean;
    }
  | {
      type: "COMPETITOR_STARTED";
      url: string;
      kind: ResearchTargetKind;
      label: string;
      index: number;
      total: number;
    }
  | {
      type: "TINYFISH_EVENT";
      url: string;
      kind: ResearchTargetKind;
      label: string;
      eventType: string;
      message: string;
      runId: string | null;
      streamingUrl: string | null;
    }
  | {
      type: "COMPETITOR_COMPLETE";
      result: ResearchCompetitorResult;
    }
  | {
      type: "COMPETITOR_ERROR";
      result: ResearchCompetitorResult;
    }
  | {
      type: "SYNTHESIS_STARTED";
    }
  | {
      type: "RESEARCH_COMPLETE";
      results: ResearchCompetitorResult[];
      summary: ResearchSummary;
    }
  | {
      type: "ERROR";
      error: string;
    };
