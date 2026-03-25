import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "clientes.csv");

function buscarDadosCliente({ cnpj }) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  const conteudo = fs.readFileSync(CSV_PATH, "utf-8");
  const linhas = conteudo.trim().split("\n");
  const cabecalho = linhas[0].split(";");

  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i].split(";");
    const registro = Object.fromEntries(
      cabecalho.map((col, idx) => [col, valores[idx]])
    );

    if (registro.cnpj === cnpjLimpo) {
      return registro;
    }
  }

  return null;
}

export default {
  definition: {
    type: "function",
    function: {
      name: "buscar_dados_cliente",
      description:
        "Busca os dados cadastrais de um cliente pelo CNPJ. Retorna razão social, nome fantasia e telefone.",
      parameters: {
        type: "object",
        properties: {
          cnpj: {
            type: "string",
            description:
              "CNPJ do cliente, com ou sem formatação (ex: 11.222.333/0001-81 ou 11222333000181)",
          },
        },
        required: ["cnpj"],
      },
    },
  },
  handler: buscarDadosCliente,
};
