import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FilaFacil Acessivel",
  description: "Sistema inclusivo de gestao de filas para unidades de saude."
};

type RootLayoutProps = {
  readonly children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
