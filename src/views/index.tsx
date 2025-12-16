// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "./layout.tsx";

export interface IndexProps {
  title: string;
  customerEmail: string;
}

export function IndexPage({ title, customerEmail }: IndexProps) {
  return (
    <Layout title={title} script="index.mjs">
      <p>First customer: {customerEmail}</p>
    </Layout>
  );
}
