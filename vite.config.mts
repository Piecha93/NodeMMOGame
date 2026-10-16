import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromProjectRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    base: "/build/",
    publicDir: false,
    build: {
        emptyOutDir: true,
        outDir: fromProjectRoot("./dist/public"),
        sourcemap: true,
        rolldownOptions: {
            input: fromProjectRoot("./client/Launcher.ts"),
            output: {
                entryFileNames: "game.js",
            },
        },
    },
});
