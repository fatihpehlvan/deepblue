import { defineConfig } from "vite";
import path from "path";

export default defineConfig({

    build: {
        rollupOptions: {
            input: {
                main: './index.html',
                game: './game.html',
            },
            output:{
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return id.toString().split('node_modules/')[1].split('/')[0].toString();
                    }
                }
            }
        }
    },
    plugins: [
        {
            name: "fix-recast",
            transform(code, id) {
                if (id.includes("recast-detour")) {
                    return code.replace(`this["Recast"]`, "window[\"Recast\"]");
                }
            },
        },
    ],
});
