// ============================================================
// Configurações da sua casa — edite à vontade.
// ============================================================
window.ACERVO_CONFIG = {
  // Nome que aparece no topo do app
  nomeCasa: "Templo Itarobá",

  // Nome do acervo
  nomeAcervo: "Acervo de Palestras",

  // Frase curta abaixo do título
  descricao: "Todas as palestras da casa, desde a fundação, para ler, estudar e reencontrar.",

  // Ano de fundação (aparece no rodapé). Deixe null para não mostrar.
  anoFundacao: null, // ex.: 1998

  // Deixe true enquanto estiver usando as palestras de exemplo.
  // Quando colocar as palestras reais, mude para false.
  modoExemplo: false,

  // ----------------------------------------------------------
  // Acesso restrito aos membros (veja supabase/COMO-CONFIGURAR.md)
  // Enquanto supabaseUrl e supabaseChave estiverem vazios, o app fica aberto como antes.
  // ----------------------------------------------------------
  acesso: {
    supabaseUrl: "https://mdmfzljblbefufigkmaa.supabase.co",
    supabaseChave: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbWZ6bGpibGJlZnVmaWdrbWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MTQzMjEsImV4cCI6MjEwOTI5MDMyMX0.G9hp1uMG_nFJ7ciUmTD4hhKKy46zDgiS_N4B5962x4s", // chave "anon public": é pública, pode ficar aqui
    entrarComGoogle: true,
    entrarComEmail: false, // ligar depois de configurar o envio de e-mails (passo 6 do COMO-CONFIGURAR.md)
    // true = textos, PDFs e áudios vêm da pasta PRIVADA do Supabase (só membros aprovados abrem).
    // Só ligue depois que o robô "Enviar acervo para o Supabase" terminar (passo 9 do COMO-CONFIGURAR.md).
    arquivosNaNuvem: true,
  },
};
