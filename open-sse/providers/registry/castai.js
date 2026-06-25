export default {
  id: "castai",
  priority: 20,
  alias: "castai",
  display: {
    name: "Cast AI (Kimchi)",
    icon: "local_fire_department",
    color: "#FF4500",
    textIcon: "CA",
    website: "https://cast.ai",
    notice: {
      apiKeyUrl: "https://cast.ai",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://llm.cast.ai/openai/v1/chat/completions",
    headers: {
      "User-Agent": "kimchi/0.1.39",
    },
    forceStream: true,
  },
  models: [
    { id: "kimi-k2.6", name: "Kimi K2.6" },
    { id: "minimax-m3", name: "MiniMax M3" },
    { id: "nemotron-3-ultra-fp4", name: "Nemotron 3 Ultra FP4" },
  ],
  serviceKinds: ["llm"],
};
