#!/usr/bin/env node

import "./proxy.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = "01ab8ac9400c4e429b23";
const SCOPE = "read:user";

async function requestDeviceCode() {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao solicitar device code: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function pollForToken(deviceCode, interval, expiresIn) {
  const deadline = Date.now() + expiresIn * 1000;
  const pollInterval = Math.max(interval, 5) * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = await res.json();

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }

    if (data.error === "slow_down") {
      await sleep(5000);
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("O código expirou. Execute o script novamente.");
    }

    if (data.error === "access_denied") {
      throw new Error("Acesso negado pelo usuário.");
    }

    throw new Error(`Erro inesperado: ${data.error} — ${data.error_description}`);
  }

  throw new Error("Timeout: o código expirou antes da autorização.");
}

function writeCredentials(token) {
  const credPath = path.join(__dirname, "credentials.json");
  const data = { github_token: token };
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2) + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Iniciando autenticação com GitHub...\n");

  const deviceData = await requestDeviceCode();
  const { device_code, user_code, verification_uri, expires_in, interval } = deviceData;

  console.log(`Acesse: ${verification_uri}`);
  console.log(`Código: ${user_code}\n`);
  process.stdout.write("Aguardando autorização");

  const token = await pollForToken(device_code, interval, expires_in);

  console.log("\n\nAutenticado com sucesso!");

  writeCredentials(token);

  console.log(`credentials.json atualizado com github_token`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
