import "./proxy.js";
import { readFileSync, globSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { LLMProvider } from "./llm-provider/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { github_token } = JSON.parse(readFileSync(resolve(__dirname, "credentials.json"), "utf-8"));

// ─── Carrega system prompt ────────────────────────────────────────────────────
const systemPrompt = readFileSync(resolve(__dirname, "system-prompt.md"), "utf-8");

// ─── Carrega todas as ferramentas ────────────────────────────────────────────

const toolFiles = globSync("tools/**/*.js", { cwd: __dirname });
const toolModules = await Promise.all(
  toolFiles.map((f) => import(pathToFileURL(resolve(__dirname, f)).href))
);

const tools = toolModules.map((m) => m.default);

// Map nome → handler para execução local
const toolHandlers = Object.fromEntries(
  tools.map((t) => [t.definition.function.name, t.handler])
);

const toolDefinitions = tools.map((t) => t.definition);

// ─── Orquestrador ────────────────────────────────────────────────────────────
const provider = new LLMProvider({
  githubToken: github_token,
  model: "gpt-4o",
});

async function run(userMessage) {
  const messages = [{ role: "user", content: userMessage }];

  console.log(`\nUsuário: ${userMessage}\n`);

  while (true) {
    const response = await provider.message(systemPrompt, messages, {
      tools: toolDefinitions,
    });

    if (response.toolCalls?.length) {
      // Adiciona a mensagem do assistente com as tool_calls ao histórico
      messages.push({
        role: "assistant",
        content: response.text || null,
        tool_calls: response.toolCalls,
      });

      // Executa cada ferramenta e adiciona o resultado ao histórico
      for (const toolCall of response.toolCalls) {
        const name = toolCall.function.name;
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
          console.error(`[tool] Falha ao parsear arguments de "${name}": ${err.message}`);
          console.error(`[tool] Raw arguments: ${toolCall.function.arguments}`);
          throw err;
        }
        const handler = toolHandlers[name];

        console.log(`[tool] ${name}(${JSON.stringify(args)})`);

        let result;
        try {
          result = handler(args) ?? { erro: "Nenhum resultado retornado" };
        } catch (err) {
          result = { erro: err.message };
        }

        console.log(`[result] ${JSON.stringify(result)}\n`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // Resposta final sem tool calls
      console.log(`Agente: ${response.text}`);
      console.log(
        `\n[uso] input=${response.usage.inputTokens} output=${response.usage.outputTokens} tokens`
      );
      break;
    }
  }
}

// ─── Exemplo ─────────────────────────────────────────────────────────────────
await run("busque os dados do cliente 44555666000114");
