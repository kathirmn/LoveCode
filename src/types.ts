export type GameMode = 'dashboard' | 'qa' | 'truth_or_dare' | 'never_have_i_ever';
export type PlayerId = 'p1' | 'p2';
export type IntensityMode = 'friendly' | 'romantic' | 'intimate' | 'spicy';

export interface Room {
  id: string;
  code: string;
  created_at: string;
}

export interface ThemeConfig {
  name: string;
  bg: string;
  navBg: string;
  primaryGrad: string;
  textAccent: string;
  borderAccent: string;
  glow: string;
  buttonBg: string;
  buttonHover: string;
  panelBg: string;
}

export interface GameState {
  room_id: string;
  game_mode: GameMode;
  intensity_mode: IntensityMode;
  current_question: string | null;
  p1_answer: string | null;
  p2_answer: string | null;
  p1_name: string | null;
  p2_name: string | null;
  p1_ready: boolean;
  p2_ready: boolean;
  current_turn: PlayerId | null;
  card_type: 'truth' | 'dare' | null;
  card_prompt: string | null;
  card_flipped: boolean;
}
