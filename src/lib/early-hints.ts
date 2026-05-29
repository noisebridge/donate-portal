import fp from "fastify-plugin";
import paths from "./paths";

const links = [
  `<${paths.assetWithHash("css/reset.css")}>; rel=preload; as=style`,
  `<${paths.assetWithHash("css/main.css")}>; rel=preload; as=style`,
  `<${paths.asset("font/inter/latin.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
  `<${paths.asset("font/jetbrains_mono/latin_normal.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
  `<${paths.asset("font/jetbrains_mono/latin_italic.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
].join(", ");

export default fp(async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    if (typeof payload !== "string") {
      return payload;
    }

    if (!reply.getHeader("content-type")?.toString().includes("text/html")) {
      return payload;
    }

    reply.header("Link", links);

    return payload;
  });
});
