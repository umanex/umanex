import type { Config } from "tailwindcss";
import preset from "@umanex/config/tailwind/preset";

const config: Config = {
  presets: [preset],
  content: ["./lib/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};

export default config;
