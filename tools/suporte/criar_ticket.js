import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "tickets.csv");

const TIPOS_VALIDOS = ["problema", "melhoria", "duvida"];

function criarTicket({ cnpj, tipo_chamado, descricao }) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  if (!TIPOS_VALIDOS.includes(tipo_chamado)) {
    throw new Error(
      `Tipo de chamado inválido. Use: ${TIPOS_VALIDOS.join(", ")}`
    );
  }

  const conteudo = fs.readFileSync(CSV_PATH, "utf-8");
  const linhas = conteudo.trim().split("\n").filter(Boolean);

  const proximoId =
    linhas.length === 1
      ? 1
      : Math.max(
          ...linhas.slice(1).map((l) => parseInt(l.split(";")[0], 10))
        ) + 1;

  const novaLinha = `${proximoId};${cnpjLimpo};${tipo_chamado};${descricao}`;
  fs.appendFileSync(CSV_PATH, novaLinha + "\n", "utf-8");

  return { id_controle: proximoId };
}

export default {
  definition: {
    type: "function",
    function: {
      name: "criar_ticket",
      description:
        "Abre um novo chamado de suporte para um cliente. Retorna o id_controle gerado.",
      parameters: {
        type: "object",
        properties: {
          cnpj: {
            type: "string",
            description: "CNPJ do cliente, com ou sem formatação.",
          },
          tipo_chamado: {
            type: "string",
            enum: ["problema", "melhoria", "duvida"],
            description: "Tipo do chamado.",
          },
          descricao: {
            type: "string",
            description: "Descrição detalhada do chamado.",
          },
        },
        required: ["cnpj", "tipo_chamado", "descricao"],
      },
    },
  },
  handler: criarTicket,
};
