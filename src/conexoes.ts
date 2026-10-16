export function conexaoCritica(chegadaPrevista: string, partidaPrevista: string, atrasoMinutos: number): boolean {
  const chegada = Date.parse(chegadaPrevista);
  const partida = Date.parse(partidaPrevista);
  if (!Number.isFinite(chegada) || !Number.isFinite(partida)) {
    return false;
  }
  return partida - chegada - atrasoMinutos * 60_000 < 40 * 60_000;
}