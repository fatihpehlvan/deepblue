import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    plugins: [
        {
            name: "fix-recast",
            transform(code, id) {
                if (id.includes("recast-detour.js")) {
                    return code.replace(`this["Recast"]`, "window[\"Recast\"]");
                }
            },
        },
    ],
    build: {
        rollupOptions: {
            input: {
                main: './index.html',
                game: './game.html',
            }
        }
    },
    // assetsInclude: './asset/**/*'
});
