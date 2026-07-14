import fp from "fastify-plugin";
import paths from "./paths";

const resetCssLink = `<${paths.assetWithHash("css/reset.css")}>; rel=preload; as=style`;
const mainCssPath = paths.assetWithHash("css/main.css");
const defaultLinks = [
  resetCssLink,
  `<${mainCssPath}>; rel=preload; as=style`,
  `<${paths.asset("font/inter/latin.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
  `<${paths.asset("font/jetbrains_mono/latin_normal.woff2")}>; rel=preload; as=font; type=font/woff2; crossorigin`,
].join(", ");

export default fp(async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    if (typeof payload !== "string") {
      return payload;
    }

    if (!reply.getHeader("content-type")?.toString().includes("text/html")) {
      return payload;
    }

    const usesDefaultLayout = payload.includes(`href="${mainCssPath}"`);
    reply.header("Link", usesDefaultLayout ? defaultLinks : resetCssLink);

    return payload;
  });
});
