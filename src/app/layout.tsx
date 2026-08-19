import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mecanix Cloud',
  description: 'ERP multi-tenant para oficinas mecânicas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Archivo e IBM Plex Mono (§ Tipografia). Carregadas por <link> em vez
            de next/font porque next/font baixa as fontes em tempo de build, o
            que quebra em ambiente sem saída para fonts.gstatic.com. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
