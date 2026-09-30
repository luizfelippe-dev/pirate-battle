import { spawn } from "node:child_process";

export async function startPreview(port) {
  const processHandle = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  await new Promise((resolve, reject) => {
    let errorOutput = "";
    const timer = setTimeout(() => {
      processHandle.kill();
      reject(new Error("Preview startup timed out."));
    }, 15000);
    processHandle.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    processHandle.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    processHandle.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    processHandle.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Preview exited (${code}). ${errorOutput}`));
    });
  });
  return { stop: () => processHandle.kill() };
}
