// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "~/components/layout";

export interface IndexProps {
  title: string;
}

export function IndexPage({ title }: IndexProps) {
  return (
    <Layout title={title} script="index.mjs" styles="index.css">
      <p>Hello, world!</p>
    </Layout>
  );
}
