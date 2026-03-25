import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "tickets.csv");

function listarChamados({ cnpj }) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  const conteudo = fs.readFileSync(CSV_PATH, "utf-8");
  const linhas = conteudo.trim().split("\n").filter(Boolean);
  const cabecalho = linhas[0].split(";");

  const chamados = linhas.slice(1).reduce((acc, linha) => {
    const valores = linha.split(";");
    const registro = Object.fromEntries(
      cabecalho.map((col, idx) => [col, valores[idx]])
    );

    if (registro.cnpj_cliente === cnpjLimpo) {
      acc.push(registro);
    }

    return acc;
  }, []);

  return chamados;
}

export default {
  definition: {
    type: "function",
    function: {
      name: "listar_chamados",
      description:
        "Lista todos os chamados de suporte de um cliente filtrando pelo CNPJ.",
      parameters: {
        type: "object",
        properties: {
          cnpj: {
            type: "string",
            description: "CNPJ do cliente, com ou sem formatação.",
          },
        },
        required: ["cnpj"],
      },
    },
  },
  handler: listarChamados,
};
