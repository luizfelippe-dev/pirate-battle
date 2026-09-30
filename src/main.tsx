import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { queryClient } from "./data/api";
import { worker } from "./data/mocks";
import "./styles.css";
import { basePath } from "./paths";
async function boot() {
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: {
      url: `${basePath}mockServiceWorker.js`,
      options: { scope: basePath },
    },
  });
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
void boot().catch(() => {
  const root = document.getElementById("root")!;
  root.textContent =
    "The harbor could not initialize. Reload this page to try again.";
});
