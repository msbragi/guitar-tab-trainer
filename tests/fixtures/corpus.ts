export const corpus = [
  {
    file: 'notes.gp3', upstream: 'guitarpro3/notes.gp3',
    sha256: 'a9ae6bb06ed259016e7a138a1b17d850491e9e2e8510c235df28a9ec81a706f1',
    title: '', bars: 1, tracks: ['Track 1'],
  },
  {
    file: 'repeat-close-alternate-endings.gp5', upstream: 'guitarpro5/repeat-close-alternate-endings.gp5',
    sha256: '10e1cb4a2a37081dec1eb690f0f1ffc90eb4ae3aa4d35ec350bcbc60f4eff1a5',
    title: '', bars: 5, tracks: ['Steel Guitar'],
  },
  {
    file: 'staves.gp5', upstream: 'guitarpro5/staves.gp5',
    sha256: 'f4036a94ef999630a547a6ef2c99fab57f15ba36c3cb0d8ddee007789bb9a709',
    title: '', bars: 1,
    tracks: ['Standard And Tablature', 'Standard Only', 'Tablature Only'],
  },
  {
    file: 'effects.gp', upstream: 'guitarpro7/effects.gp',
    sha256: '178b4d99171febb68c86f418aa451c44adc4c7a1ec2e31bcda587b303bb2867b',
    title: 'Effects', bars: 32, tracks: ['Track 1'],
  },
] as const;
