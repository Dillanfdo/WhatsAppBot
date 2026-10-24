import "server-only";
import { env } from "@/lib/env";
import { modelIsInstalled } from "@/lib/ai/llm/parse";

export type LlmHealth = {
  provider: "ollama" | "anthropic";
  model: string;
  reachable: boolean;
  modelInstalled: boolean;
  toolSupport: boolean | null;
  message: string;
};

const probeTimeoutMs = 10_000;

const fetchJson = async (url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(probeTimeoutMs),
  });
  const text = await response.text();
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { ok: response.ok, status: response.status, body };
};

const tagNames = (body: unknown): string[] => {
  if (!body || typeof body !== "object" || !("models" in body) || !Array.isArray(body.models)) {
    return [];
  }
  return body.models.flatMap((model) => {
    if (!model || typeof model !== "object" || !("name" in model) || typeof model.name !== "string") {
      return [];
    }
    return [model.name];
  });
};

const toolSupportFromShow = (body: unknown): boolean | null => {
  if (!body || typeof body !== "object" || !("capabilities" in body)) {
    return null;
  }
  const capabilities = body.capabilities;
  if (!Array.isArray(capabilities)) {
    return null;
  }
  return capabilities.some((item) => item === "tools");
};

const checkOllama = async (): Promise<LlmHealth> => {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
  const model = env.OLLAMA_MODEL;
  try {
    const tags = await fetchJson(`${base}/api/tags`);
    if (!tags.ok) {
      return {
        provider: "ollama",
        model,
        reachable: false,
        modelInstalled: false,
        toolSupport: null,
        message: `Ollama responded ${tags.status} from ${base}. Check that \`ollama serve\` is running.`,
      };
    }
    const names = tagNames(tags.body);
    const installed = modelIsInstalled(names, model);
    if (!installed) {
      return {
        provider: "ollama",
        model,
        reachable: true,
        modelInstalled: false,
        toolSupport: null,
        message: `Ollama is reachable, but "${model}" is not installed. Run \`ollama pull ${model}\`.`,
      };
    }
    const show = await fetchJson(`${base}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const toolSupport = show.ok ? toolSupportFromShow(show.body) : null;
    const toolMessage =
      toolSupport === false
        ? " The model does not advertise tool support. Pull qwen2.5:7b, llama3.1:8b, or qwen3:8b."
        : toolSupport === true
          ? " Tool support is advertised."
          : " Tool support was not listed by /api/show.";
    return {
      provider: "ollama",
      model,
      reachable: true,
      modelInstalled: true,
      toolSupport,
      message: `Ollama is reachable and ${model} is installed.${toolMessage}`,
    };
  } catch {
    return {
      provider: "ollama",
      model,
      reachable: false,
      modelInstalled: false,
      toolSupport: null,
      message: `Ollama is not reachable at ${base}. Run \`ollama serve\`.`,
    };
  }
};

export const checkLlm = async (): Promise<LlmHealth> => {
  if (env.LLM_PROVIDER === "anthropic") {
    const model = env.ANTHROPIC_MODEL_DEFAULT ?? "";
    const hasKey = Boolean(env.ANTHROPIC_API_KEY);
    return {
      provider: "anthropic",
      model,
      reachable: hasKey,
      modelInstalled: hasKey,
      toolSupport: hasKey ? true : null,
      message: hasKey
        ? `Anthropic is selected (${model}). The API key is set.`
        : "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing.",
    };
  }
  return checkOllama();
};

export const formatLlmHealth = (health: LlmHealth): string =>
  [
    `provider: ${health.provider}`,
    `model: ${health.model}`,
    `reachable: ${health.reachable ? "yes" : "no"}`,
    `installed: ${health.modelInstalled ? "yes" : "no"}`,
    `tools: ${health.toolSupport === null ? "unknown" : health.toolSupport ? "yes" : "no"}`,
    health.message,
  ].join("\n");
