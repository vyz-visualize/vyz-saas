// A fita de 0 a 9 e os outros caracteres ("R$", vírgula, "mil") são desenhados pelo CSS
// (::before), não são texto da página: leitor de tela, seleção, cópia e "ler em voz alta" só
// encontram o valor inteiro, uma vez ("R$ 61,0 mil"), nunca "0 1 2 3…" nem "R $ , m i l".

type OdometerProps = {
  value: string;
  /** O que o leitor de tela lê: o valor final (padrão: value). Na contagem inicial, value é zerado. */
  label?: string;
  className?: string;
  /** Atraso entre dígitos, da direita para a esquerda (ms). */
  stagger?: number;
};

/**
 * Número que troca dígito por dígito, como odômetro. Cada coluna é uma fita
 * de 0 a 9 que só se move em transform; a largura vem de tabular-nums.
 * As colunas ficam aria-hidden; o valor final, num texto só para leitor de tela.
 */
export function Odometer({ value, label = value, className = "", stagger = 28 }: OdometerProps) {
  const chars = value.split("");
  return (
    <span className={`odo ${className}`}>
      <span className="sr-only">{label}</span>
      <span className="odo-track" aria-hidden>
        {chars.map((c, i) => {
          // chave a partir da direita: as unidades ficam na mesma coluna
          const fromRight = chars.length - i;
          if (!/\d/.test(c)) {
            return (
              <span key={`c${fromRight}`} className="odo-char" data-c={c === " " || c === "\u00a0" ? "\u00a0" : c} />
            );
          }
          return (
            <span key={`d${fromRight}`} className="odo-digit">
              <span
                className="odo-strip"
                style={{
                  transform: `translateY(${-Number(c) * 10}%)`,
                  transitionDelay: `${fromRight * stagger}ms`,
                }}
              />
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Mesmo formato, com todos os dígitos zerados (para a contagem inicial). */
export function zeroed(value: string): string {
  return value.replace(/\d/g, "0");
}
