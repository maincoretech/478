import logger from "../utils/logger";

// 初始化牌池
let cardsPool = [
  ,
  ,
  ,
  ,
  ,
  ,
  [1, 1, 1, 1, 2], // 6
  [1, 1, 1, 2, 2],
  [1, 1, 2, 2, 2], // 8
  [1, 1, 1, 1, 5],
  [1, 1, 1, 2, 5], // 10
  [1, 1, 2, 2, 5],
  [1, 2, 2, 2, 5], // 12
  [1, 1, 1, 5, 5],
  [1, 1, 2, 5, 5], // 14
  [1, 2, 2, 5, 5],
  [2, 2, 2, 5, 5], // 16
  [1, 1, 5, 5, 5],
  [1, 2, 5, 5, 5], // 18
  [2, 2, 5, 5, 5],
];

export function shuffle(sumCardsPool) {
  let randomCard = cardsPool[sumCardsPool][Math.floor(Math.random() * 5)];
  if (randomCard == 5) {
    randomCard = 4;
  }
  return randomCard;
}
