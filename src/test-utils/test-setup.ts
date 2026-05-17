import { Glob } from "bun";

const glob = new Glob("**/*.mock.ts");
for await (const file of glob.scan({
  cwd: `${import.meta.dir}/..`,
  absolute: true,
})) {
  await import(file);
}
