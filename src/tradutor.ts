//MENSAGENS AUTOMÁTICAS PARA O CLIENTE
export const MENSAGEM_CONEXAO_CRITICA =
  'Acompanhamento da sua conexão em Recife: Identificamos um ajuste no seu primeiro voo. Nossa equipe de solo em Recife já está ciente e orientará o seu desembarque e o acesso ao seu próximo voo para Fortaleza.';

const modelos: Record<string, (voo: string) => string> = {
  PANE_TECNICA: (voo) =>
    `Seu voo ${voo} está passando por uma verificação técnica adicional, feita para garantir a sua segurança. Nossa equipe já está cuidando disso e vamos avisar assim que houver novidades. O atendimento está pronto para ajudar você com as próximas opções.`,
  CONDICAO_METEOROLOGICA: (voo) =>
    `As condições do tempo estão exigindo cautela e o seu voo ${voo} pode sofrer ajustes de horário. Seguimos acompanhando de perto e vamos manter você informado.`,
  ATRASO_TRIPULACAO: (voo) =>
    `O seu voo ${voo} está com um pequeno ajuste de horário para reorganizarmos a equipe de bordo. Avisaremos sobre o novo horário o quanto antes.`,
  CANCELAMENTO: (voo) =>
    `Infelizmente o voo ${voo} não poderá sair como planejado. Já estamos preparando as melhores alternativas para você, e o atendimento vai orientar sobre reacomodação e assistência.`,
};

export function gerarMensagemCliente(tipo: string, numeroVoo: string): string {
  const modelo = modelos[tipo];
  if (modelo) {
    return modelo(numeroVoo);
  }
  return `Estamos acompanhando o seu voo ${numeroVoo} e avisaremos você sobre qualquer novidade.`;
}