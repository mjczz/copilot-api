import config from "@echristian/eslint-config"

export default config({
  ignores: [".claude/workflows/**"],
  prettier: {
    plugins: ["prettier-plugin-packagejson"],
  },
})
