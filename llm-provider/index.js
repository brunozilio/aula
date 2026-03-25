const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

export class LLMProvider {
  #githubToken;
  #copilotToken = null;
  #copilotTokenExpiresAt = 0;
  #proxyUrl = null;
  #model;

  constructor({ githubToken, model = "gpt-4o" }) {
    this.#githubToken = githubToken;
    this.#model = model;
  }

  #isTokenExpired() {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds >= this.#copilotTokenExpiresAt - 60;
  }

  async #refreshCopilotToken() {
    const response = await fetch(COPILOT_TOKEN_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${this.#githubToken}`,
        "Editor-Version": "vscode/1.95.0",
        "Editor-Plugin-Version": "copilot-chat/0.22.4",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh Copilot token (${response.status}): ${error}`);
    }

    const data = await response.json();
    this.#copilotToken = data.token;
    this.#copilotTokenExpiresAt = data.expires_at;
    this.#proxyUrl = data.endpoints?.api ?? "https://api.individual.githubcopilot.com";
  }

  async message(systemPrompt, messages, options = {}) {
    if (!this.#copilotToken || this.#isTokenExpired()) {
      await this.#refreshCopilotToken();
    }

    const copilotMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const body = {
      model: this.#model,
      messages: copilotMessages,
      stream: true,
    };

    if (options.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.#proxyUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#copilotToken}`,
        "Copilot-Integration-Id": "vscode-chat",
        "Editor-Version": "vscode/1.95.0",
        "Editor-Plugin-Version": "copilot-chat/0.22.4",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Copilot API error (${response.status}): ${error}`);
    }

    const text = await response.text();
    return this.#parseStreamingResponse(text);
  }

  #parseStreamingResponse(rawText) {
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const toolCallsMap = {};

    for (const line of rawText.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;

      try {
        const chunk = JSON.parse(data);
        const choice = chunk.choices?.[0];

        if (choice?.delta?.content) {
          text += choice.delta.content;
        }

        // Tool calls chegam fragmentados no stream — acumula por index
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const idx = tc.index;
          if (!toolCallsMap[idx]) {
            toolCallsMap[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
          }
          if (tc.id) toolCallsMap[idx].id = tc.id;
          if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments;
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      } catch (err) {
        console.warn(`[stream] chunk ignorado (parse error): ${err.message}\n  → data: ${data.slice(0, 120)}`);
      }
    }

    const toolCalls = Object.keys(toolCallsMap).length
      ? Object.values(toolCallsMap)
      : null;

    return { text, toolCalls, usage: { inputTokens, outputTokens } };
  }
}
