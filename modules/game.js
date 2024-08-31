import logger from "../utils/logger";

// 牌池表
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

// 结果表
let result = [
  ,
  [, [0, 0], [1, "B"], , , [5, "A"]],
  [, [1, "A"], [0, 0], , , [2, "B"]],
  ,
  ,
  [, [5, "B"], [2, "A"], , , [0, 0]],
];

// 随机抽牌
export async function shuffle(sumCardsPool) {
  let randomCard = cardsPool[sumCardsPool][Math.floor(Math.random() * 5)];
  return randomCard;
}

// 返回输牌和赢者
export async function determine(cardA, cardB) {
  let resultArr = result[cardA][cardB];
  return resultArr;
}
