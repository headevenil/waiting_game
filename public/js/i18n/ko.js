// Shell copy. Instructions in 해요체, reactions in short 반말. Particles after names always go through josa().
import { josa } from './josa.js';

export const t = {
  appName: '웨이팅 게임',

  // pass gate + hold
  passTo: (name) => `${name}에게 폰을 넘겨주세요`,
  passToSuffix: '에게 폰을 넘겨주세요',
  iAm: (name) => `제가 ${josa(name, '이에요/예요')}`,
  holdHint: '꾹 누르는 동안만 보여요',
  holdHere: '여기를 꾹 누르세요',
  holdAria: '꾹 누르고 있는 동안 비밀이 보여요',
  yourTurn: (name) => `${josa(name, '아/야')}, 네 차례야!`,

  // top bar + sheets
  pause: '일시정지',
  menu: '메뉴',
  undo: '되돌리기',
  resume: '계속하기',
  rules: '규칙 보기',
  home: '홈으로',
  endGame: '게임 끝내기',
  endConfirm: '게임을 끝낼까요?',
  endConfirmBody: '지금 게임의 점수는 저장되지 않아요.',
  end: '끝내기',
  cancel: '취소',
  paused: '일시정지 중',
  plus30: '+30초',
  timeUp: '시간 끝!',

  // home
  resumeCard: '이어서 하기',
  rosterTitle: '오늘의 멤버',
  editRoster: '멤버 편집',
  needRoster: '먼저 함께할 멤버를 4~6명 등록해 주세요.',
  addRoster: '멤버 등록하기',
  pickGame: '게임 고르기',
  surprise: '아무거나 골라 줘',
  todayTop: '오늘의 1등',
  teamBests: '팀 최고 기록',
  minutes: ([a, b]) => `${a}~${b}분`,
  playersRange: ({ min, max }) => `${min}~${max}명`,
  offlineReady: '오프라인 준비 완료',
  offlineNotYet: '오프라인 준비 중…',
  updateReady: '새 버전이 있어요',
  update: '업데이트',
  iosGuideTitle: '홈 화면에 추가하면 앱처럼 쓸 수 있어요',
  iosGuideBody: '공유 버튼 → 홈 화면에 추가',
  close: '닫기',
  night: '밤',
  day: '낮',
  settings: '설정',

  // rules screen
  start: '시작하기',
  howToPlay: '이렇게 놀아요',
  sides: '누구 편?',
  options: '설정',
  tooFew: (min) => `${min}명 이상 있어야 해요`,
  tooMany: (max) => `${max}명까지만 할 수 있어요`,
  replaceGame: '진행 중인 게임이 있어요',
  replaceGameBody: '새로 시작하면 진행 중인 게임은 사라져요.',
  startNew: '새로 시작',
  random: '랜덤',

  // results
  again: '한 판 더',
  otherGame: '다른 게임',
  pointsTitle: '이번 판 점수',
  noPoints: '이번 판은 개인 점수가 없어요',

  // roster
  rosterEdit: '멤버 편집',
  rosterHelp: '4~6명까지 함께할 수 있어요. 이름 옆 색을 누르면 바뀌어요.',
  namePlaceholder: (i) => `${i}번 멤버 이름`,
  addPlayer: '+ 멤버 추가',
  remove: '빼기',
  save: '저장하기',
  nameEmpty: '이름을 모두 써 주세요',
  nameDup: '같은 이름이 있어요',
  rosterCount: '4~6명이어야 해요',

  // settings
  theme: '화면',
  themeAuto: '자동',
  haptics: '진동',
  on: '켜기',
  off: '끄기',
  resetScores: '점수 초기화',
  resetScoresConfirm: '오늘 점수를 모두 0으로 돌릴까요?',
  clearRecent: '최근 단어 기록 지우기',
  resetAll: '모든 데이터 지우기',
  resetAllConfirm: '멤버, 점수, 진행 중인 게임이 모두 사라져요.',
  done: '완료',
  version: '버전',
};
