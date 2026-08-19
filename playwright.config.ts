import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do wizard. Roda contra o build de produção, na mesma porta do dev, e
 * sobe o servidor sozinho.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3120',
    ...devices['Desktop Chrome'],
    launchOptions: {
      // O ambiente traz o Chromium pré-instalado, e a versão dele pode não
      // ser a que este @playwright/test espera. Apontar o executável evita
      // um download que a política de rede bloquearia de qualquer forma.
      executablePath:
        process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    },
  },
  webServer: {
    command: 'npx next start -p 3120',
    url: 'http://127.0.0.1:3120/login',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
