const BALL_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const

export function bingoBallLabel(number: number): string {
  const letter = BALL_LETTERS[Math.floor((number - 1) / 15)]
  return `${letter} ${number}`
}
