/**
 * Capas de exemplo do seed (só dev): ilustrações abstratas geradas com sharp
 * a partir de SVG, nas cores do blog. Nada baixado da internet.
 */
import sharp from 'sharp'

export type CoverSpec = {
  key: string
  alt: string
  bg: string
  a: string
  b: string
  shape: 'balao' | 'ondas' | 'grade' | 'sol'
}

function shapes(spec: CoverSpec): string {
  switch (spec.shape) {
    case 'balao':
      return `<path d="M520 220h560a80 80 0 0 1 80 80v300a80 80 0 0 1-80 80H780l-160 130V680h-100a80 80 0 0 1-80-80V300a80 80 0 0 1 80-80Z" fill="${spec.a}"/>
<rect x="770" y="300" width="60" height="210" rx="30" fill="${spec.b}"/><circle cx="800" cy="580" r="36" fill="${spec.b}"/>`
    case 'ondas':
      return [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<path d="M0 ${380 + i * 110} C 300 ${300 + i * 110}, 500 ${480 + i * 110}, 800 ${390 + i * 110} S 1300 ${300 + i * 110}, 1600 ${400 + i * 110} V 960 H 0 Z" fill="${i % 2 ? spec.a : spec.b}" opacity="${0.35 + i * 0.13}"/>`,
        )
        .join('')
    case 'grade':
      return Array.from({ length: 6 * 10 }, (_, n) => {
        const x = 180 + (n % 10) * 128
        const y = 160 + Math.floor(n / 10) * 120
        const on = (n * 7) % 5 === 0
        return `<rect x="${x}" y="${y}" width="96" height="88" rx="14" fill="${on ? spec.b : spec.a}" opacity="${on ? 1 : 0.55}"/>`
      }).join('')
    case 'sol':
      return `<circle cx="1100" cy="420" r="230" fill="${spec.b}"/>
<rect x="0" y="620" width="1600" height="340" fill="${spec.a}"/>
<path d="M200 620 L520 300 L820 620 Z" fill="${spec.a}" opacity="0.75"/>`
  }
}

export async function renderCover(spec: CoverSpec): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
<rect width="1600" height="960" fill="${spec.bg}"/>${shapes(spec)}</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export const COVERS: CoverSpec[] = [
  {
    key: 'balao',
    alt: 'Balão de fala laranja com um ponto de exclamação amarelo',
    bg: '#FAF7F0',
    a: '#D9480F',
    b: '#FFD23F',
    shape: 'balao',
  },
  {
    key: 'ondas',
    alt: 'Ondas em camadas laranja e amarelas sobre fundo escuro',
    bg: '#1B1B1B',
    a: '#FF7A4D',
    b: '#FFC83D',
    shape: 'ondas',
  },
  {
    key: 'grade',
    alt: 'Grade de blocos arredondados, como racks de um homelab',
    bg: '#22313F',
    a: '#3E5568',
    b: '#FFD23F',
    shape: 'grade',
  },
  {
    key: 'sol',
    alt: 'Sol amarelo atrás de uma montanha laranja',
    bg: '#FFE9C7',
    a: '#D9480F',
    b: '#FFB703',
    shape: 'sol',
  },
]
