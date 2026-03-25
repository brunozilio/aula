import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "tickets.csv");

function obterChamado({ id_controle }) {
  const id = parseInt(id_controle, 10);

  const conteudo = fs.readFileSync(CSV_PATH, "utf-8");
  const linhas = conteudo.trim().split("\n").filter(Boolean);
  const cabecalho = linhas[0].split(";");

  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i].split(";");
    const registro = Object.fromEntries(
      cabecalho.map((col, idx) => [col, valores[idx]])
    );

    if (parseInt(registro.id_controle, 10) === id) {
      return registro;
    }
  }

  return null;
}

export default {
  definition: {
    type: "function",
    function: {
      name: "obter_chamado",
      description: "Busca um chamado de suporte pelo id_controle.",
      parameters: {
        type: "object",
        properties: {
          id_controle: {
            type: "number",
            description: "ID numérico do chamado.",
          },
        },
        required: ["id_controle"],
      },
    },
  },
  handler: obterChamado,
};
