import fp from "fastify-plugin";
import { assetPath } from "~/assets";

const links = [
  `<${assetPath("css/reset.css")}>; rel=preload; as=style`,
  `<${assetPath("css/main.css")}>; rel=preload; as=style`,
  `<${assetPath("font/inter/latin.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
  `<${assetPath("font/jetbrains_mono/latin_normal.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
  `<${assetPath("font/jetbrains_mono/latin_italic.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
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
