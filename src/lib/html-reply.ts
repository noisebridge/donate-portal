import fp from "fastify-plugin";

/** Adds `reply.html()`, which sends a JSX element as an HTML response. */
export default fp(async (fastify) => {
  fastify.decorateReply("html", function (element: JSX.Element) {
    return this.type("text/html; charset=utf-8").send(element.toString());
  });
});
